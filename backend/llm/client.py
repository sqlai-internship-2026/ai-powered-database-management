"""One HTTP call to a hosted language model, and the vocabulary for its failures.

The endpoint is OpenAI-compatible, which means a plain POST to
/chat/completions carrying a Bearer key. That is small enough that no client
package is worth adding - urllib does it, exactly as check_model.py does when
it verifies the endpoint on its own.

What this module adds over that raw call is the part every feature would
otherwise repeat: reading the key, retrying while the free tier is busy, and
turning each way the call can fail into a named exception whose message is
already fit to show a user. The API layer maps those names to status codes; it
never has to read an HTTP body or an urllib traceback.

Configuration comes from the repository root .env, the same file db.py reads:

    NVIDIA_API_KEY=nvapi-...
    NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
    NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
"""

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1"

# The flagship models share a small free capacity pool and answer 429 far more
# often than they answer a question. This one was measured as responsive on the
# same key that another refused outright, so it is the default rather than the
# better known name.
DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b"

# A reasoning model spends most of its output on working out that is never
# shown, so the budget has to cover the thinking as well as the answer: a
# one-sentence reply measured at 249 completion tokens. Too small a budget does
# not shorten the reply, it cuts off the thinking and no answer arrives at all,
# which is why running out is an error here rather than a short answer.
SQL_TOKENS = 1500

# Summarising rows that are already in hand needs far less working out.
SUMMARY_TOKENS = 400

# Measured at roughly 10 seconds per call. Sixty leaves room for a slow day
# without leaving a request hanging until the browser gives up on its own.
DEFAULT_TIMEOUT = 60

# How long to wait before each retry when the endpoint is busy. It sends no
# Retry-After header, so these are our own choice. They earn their keep mostly
# in run_eval.py, which fires twenty questions back to back and would otherwise
# score a refused request as a wrong answer.
RATE_LIMIT_WAITS = (3, 8, 20)

# Both mean "busy, try again": 429 when the free capacity is saturated, 503
# when the endpoint is momentarily overloaded. Neither says the request is bad.
BUSY_STATUSES = (429, 503)


class LLMError(RuntimeError):
    """A model call failed. The message is written to be shown to a user."""


class LLMNotConfigured(LLMError):
    """No key, a rejected key, or a model id the endpoint does not serve.

    All three are the same thing from the caller's side: an operator has to fix
    .env before any question can be answered.
    """


class LLMUnavailable(LLMError):
    """The endpoint could not be reached, or answered with something unusable."""


class LLMRateLimited(LLMError):
    """Still busy after every retry."""


class LLMTruncated(LLMError):
    """The reply ran out of tokens before it finished."""


class _Busy(Exception):
    """Internal marker: this attempt hit a busy status and may be retried."""


def model_name() -> str:
    """The configured model id.

    Safe to call without a key: it travels with an answer so the UI can name
    what wrote it, and that has to work even when a call is about to fail.
    """
    return os.getenv("NVIDIA_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _settings():
    key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not key:
        raise LLMNotConfigured(
            "No language model is configured. Set NVIDIA_API_KEY in .env."
        )
    base = (os.getenv("NVIDIA_BASE_URL", "").strip() or DEFAULT_BASE_URL).rstrip("/")
    return key, model_name(), base


def _from_http_error(error):
    """The exception an HTTP status deserves, carrying the endpoint's own words.

    The body names the real problem - a model id that does not exist, a key
    without entitlement - and dropping it turns every one of those into an
    indistinguishable "request failed".
    """
    try:
        detail = json.loads(error.read().decode("utf-8"))
        said = detail.get("detail") or detail.get("message") or ""
    except Exception:  # noqa: BLE001 - a failed diagnosis must not replace the error
        said = ""
    said = f" ({said})" if said else ""

    if error.code in (401, 403):
        return LLMNotConfigured(
            f"The language model rejected the API key{said}. "
            "Check NVIDIA_API_KEY in .env."
        )
    if error.code == 404:
        return LLMNotConfigured(
            f"The endpoint does not serve the model '{model_name()}'{said}. "
            "Check NVIDIA_MODEL in .env; check_model.py --list-models prints "
            "the ids it accepts."
        )
    return LLMUnavailable(
        f"The language model answered with an error (HTTP {error.code}){said}."
    )


def _attempt(url, key, payload, timeout):
    """One POST. Raises _Busy when the endpoint asks to be tried again."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        if error.code in BUSY_STATUSES:
            raise _Busy from error
        raise _from_http_error(error) from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        # No connection, a DNS failure, a proxy refusal or a timeout. Only the
        # first of those is something the person asking can act on, so they
        # share one line rather than each getting a message of its own.
        raise LLMUnavailable(
            "Could not reach the language model. Check your internet connection."
        ) from error

    try:
        return json.loads(body)
    except ValueError as error:
        raise LLMUnavailable(
            "The language model returned a reply that could not be read."
        ) from error


def chat(system: str, user: str, max_tokens: int = SQL_TOKENS,
         temperature: float = 0.0, timeout: int = DEFAULT_TIMEOUT) -> str:
    """Send one system and one user message, return what the model wrote.

    Nothing is remembered between calls: the endpoint holds no session and
    neither does this function, so every question stands on its own.

    Temperature defaults to 0 because both callers want one question to produce
    the same answer twice - so a generated query is reproducible, and so an
    eval score means something.

    Raises only LLMError subclasses. A busy endpoint is retried on the schedule
    in RATE_LIMIT_WAITS, so a saturated free tier costs about half a minute
    before giving up rather than failing on the first refusal.
    """
    key, model, base = _settings()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    attempts = len(RATE_LIMIT_WAITS) + 1
    for attempt in range(attempts):
        try:
            body = _attempt(f"{base}/chat/completions", key, payload, timeout)
            break
        except _Busy as busy:
            if attempt == attempts - 1:
                raise LLMRateLimited(
                    "The language model is busy and refused several attempts. "
                    "Wait a moment and ask again."
                ) from busy
            time.sleep(RATE_LIMIT_WAITS[attempt])

    try:
        choice = body["choices"][0]
        message = choice["message"]
    except (KeyError, IndexError, TypeError) as error:
        raise LLMUnavailable(
            "The language model returned a reply in an unexpected shape."
        ) from error

    if choice.get("finish_reason") == "length":
        raise LLMTruncated(
            f"The language model ran out of room after {max_tokens} tokens and "
            "stopped before finishing its answer."
        )

    # A reasoning model keeps its working out in reasoning_content. It is not
    # part of the answer and is dropped on purpose: the caller parses SQL out of
    # this string, and thinking aloud about a DELETE would parse as one.
    content = (message.get("content") or "").strip()
    if not content:
        raise LLMUnavailable("The language model returned an empty reply.")
    return content
