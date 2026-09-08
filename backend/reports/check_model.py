"""Connectivity check for the hosted language model behind Ask.

This answers one question only: does a request reach the model and come back
with a reply? Three things have to be true, and they are checked in order so a
failure names its own cause instead of surfacing as "Ask is broken":

  1. reachable  - the endpoint answers at all (network, proxy, firewall)
  2. authorised - the API key is accepted and entitled to the model
  3. answering  - a non-empty reply actually comes back

It says nothing about the quality of what the model writes. Whether it can turn
a question into correct SQL is a separate matter, measured by run_eval.py
against the questions in eval_cases.py once generate_sql() calls a model.

Nothing here touches the database, the REST API or Keycloak - no import of
db.py, no connection string, no SQL - so it stays runnable while the whole rest
of the stack is down. Only the standard library is used for the HTTP call: the
endpoint is OpenAI-compatible, which is a plain POST, so no client package is
needed.

Configuration comes from the repository root .env, the same file db.py reads:

    NVIDIA_API_KEY=nvapi-...
    NVIDIA_MODEL=moonshotai/kimi-k3
    NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

Run it from the repository root:

    .venv\\Scripts\\python.exe backend\\reports\\check_model.py
    .venv\\Scripts\\python.exe backend\\reports\\check_model.py --list-models
    .venv\\Scripts\\python.exe backend\\reports\\check_model.py --prompt "Say hello."
    .venv\\Scripts\\python.exe backend\\reports\\check_model.py --chat
    .venv\\Scripts\\python.exe backend\\reports\\check_model.py --chat --temperature 0.7
    .venv\\Scripts\\python.exe backend\\reports\\check_model.py --stream
    .venv\\Scripts\\python.exe backend\\reports\\check_model.py --model moonshotai/kimi-k2.6

--chat is a conversation: type a message, read the reply, keep going. The
temperature defaults to 0 because a check wants a repeatable answer; raise it
when you are exploring how the model writes.

A single check exits 0 only when the model answered, so it can gate a larger
setup step; --chat is interactive and always exits 0.

This is deliberately not named test_*.py: pytest must not collect it. The
backend suite runs without a network, a key or a model, and a check that needs
all three does not belong in it.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

try:  # The backend venv has python-dotenv; a bare interpreter may not.
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:  # pragma: no cover - convenience only
    pass

# A Windows console still defaults to a legacy code page, which turns the
# curly apostrophe in a reply into a replacement character and raises outright
# on Turkish letters. The endpoint answers in UTF-8, so print it as UTF-8.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, OSError):  # pragma: no cover - non-standard stream
        pass

DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL = "moonshotai/kimi-k3"

# How long to wait before each retry when the model is busy, in seconds. The
# endpoint returns no Retry-After header, so these are our own choice: short
# enough that a conversation still feels live, long enough to let it free up.
RATE_LIMIT_WAITS = (3, 8, 20)

# Both mean "busy, try again": 429 when the model's free capacity is saturated,
# 503 when it is momentarily overloaded. Neither says anything is wrong with the
# request, so both are worth retrying.
BUSY_STATUSES = (429, 503)

# Deliberately trivial. A short, unambiguous instruction makes a wrong reply
# obvious at a glance, and keeps the reply cheap in tokens on a free tier.
DEFAULT_PROMPT = (
    "Reply with one short sentence confirming you received this message, "
    "then name the model you are."
)


def endpoint(path, api_key, base_url, payload=None, stream=False, timeout=120):
    """POST when a payload is given, GET otherwise, and hand back the response."""
    headers = {
        "Authorization": "Bearer " + api_key,
        "Accept": "text/event-stream" if stream else "application/json",
    }
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        base_url.rstrip("/") + path,
        data=body,
        headers=headers,
        method="POST" if body else "GET",
    )
    return urllib.request.urlopen(request, timeout=timeout)


def report_http_error(error):
    """Name the likely cause, because the status code alone is not actionable."""
    # stderr is unbuffered while stdout is not, so without this the failure
    # prints above the header describing the request that failed.
    sys.stdout.flush()
    detail = error.read().decode("utf-8", "replace")
    causes = {
        401: "The key was rejected. Generate a new one and update NVIDIA_API_KEY in .env.",
        403: "The key is valid but not entitled to this model. Check the model page for access.",
        404: "This model id is not served here. Run --list-models and copy the exact id.",
        422: "The request shape was refused - the offending field is named in the body below.",
        # Measured, not assumed: a 429 on one model arrives in under a second
        # while other models answer normally on the same key in the same
        # minute. So this is that model's shared free-tier capacity, not a
        # personal quota that has run out.
        429: ("This model's free capacity is busy - it is not your quota. The same key "
              "usually works on another model right away, so try --model with one from "
              "--list-models, or retry this one later."),
        503: ("The model is overloaded right now. Same situation as a 429: transient, "
              "and another model on the same key will usually answer."),
    }
    print("FAIL  HTTP {0} {1}".format(error.code, error.reason), file=sys.stderr)
    if error.code in causes:
        print("      " + causes[error.code], file=sys.stderr)
    print("      Response body: " + detail[:1500], file=sys.stderr)


def chat_payload(model, messages, max_tokens, temperature, stream):
    """Build the request body. `messages` is the whole conversation so far.

    The endpoint keeps no session of its own: every request carries the full
    history, which is why --chat resends it each turn.
    """
    return {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": stream,
    }


def list_models(api_key, base_url):
    """Print the ids this endpoint actually serves.

    Worth doing before anything else: the name shown on a model's web page is
    not always the id the API accepts, and a wrong id fails as a 404 that reads
    like an outage.
    """
    with endpoint("/models", api_key, base_url) as response:
        served = json.load(response).get("data", [])
    print("{0} model ids served by {1}".format(len(served), base_url))
    for model_id in sorted(entry.get("id", "") for entry in served):
        print("  " + model_id)
    return bool(served)


def ask_once(api_key, base_url, model, prompt, max_tokens, temperature):
    started = time.monotonic()
    with endpoint("/chat/completions", api_key, base_url,
                  chat_payload(model, [{"role": "user", "content": prompt}],
                               max_tokens, temperature, False)) as response:
        result = json.load(response)
    elapsed = time.monotonic() - started

    choice = (result.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    # A reasoning model keeps its working out in a separate field. Ask will
    # discard it, but seeing it here tells you which field carries the answer.
    thinking = message.get("reasoning_content")
    if thinking:
        print("--- reasoning ({0} chars, discarded by Ask) ---".format(len(thinking)))
        print(thinking.strip()[:600])
    answer = (message.get("content") or "").strip()
    print("--- reply ---")
    print(answer or "(no content)")
    print("--- details ---")
    print("model served  : {0}".format(result.get("model")))
    print("finish reason : {0}".format(choice.get("finish_reason")))
    print("tokens        : {0}".format(result.get("usage")))
    print("latency       : {0:.2f}s".format(elapsed))
    if choice.get("finish_reason") == "length":
        print("note          : the reply was cut off; raise --max-tokens")
    return answer


def ask_streaming(api_key, base_url, model, prompt, max_tokens, temperature):
    """Same request over server-sent events.

    Ask answers a typed question, so time to first token is what a user feels.
    Streaming is checked separately because it can fail on its own - a proxy
    that buffers the response breaks it while the plain call still works.
    """
    started = time.monotonic()
    first_token = None
    pieces = []
    print("--- reply (streamed) ---")
    with endpoint("/chat/completions", api_key, base_url,
                  chat_payload(model, [{"role": "user", "content": prompt}],
                               max_tokens, temperature, True), stream=True) as response:
        for raw in response:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            chunk = line[len("data:"):].strip()
            if chunk == "[DONE]":
                break
            delta = (json.loads(chunk).get("choices") or [{}])[0].get("delta") or {}
            piece = delta.get("content") or ""
            if piece:
                if first_token is None:
                    first_token = time.monotonic() - started
                pieces.append(piece)
                sys.stdout.write(piece)
                sys.stdout.flush()
    print("")
    print("--- details ---")
    print("chunks         : {0}".format(len(pieces)))
    print("first token in : {0}".format(
        "never" if first_token is None else "{0:.2f}s".format(first_token)))
    print("total          : {0:.2f}s".format(time.monotonic() - started))
    return "".join(pieces).strip()


def chat_session(api_key, base_url, model, max_tokens, temperature):
    """Type messages, read replies, until you stop.

    Useful for getting a feel for the model - how it words a refusal, whether
    it wraps SQL in markdown, how long an answer takes - which is what decides
    the prompt that Ask will eventually send.

    The whole conversation is resent every turn, because the endpoint holds no
    session. So the prompt grows as you go, and a long session costs more tokens
    per message than a short one.
    """
    print("Talking to {0}. Type a message and press Enter.".format(model))
    print("A blank line, 'exit', or Ctrl+C ends it. History is kept in memory only.")
    history = []

    while True:
        try:
            typed = input("\nyou   > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nended.")
            return True
        if not typed or typed.lower() in ("exit", "quit"):
            print("ended.")
            return True

        history.append({"role": "user", "content": typed})
        payload = chat_payload(model, history, max_tokens, temperature, False)
        result = None
        started = time.monotonic()

        # A busy status here says nothing is wrong with the message, and the
        # endpoint sends no Retry-After, so the delay is ours to pick. Waiting
        # beats making someone retype a message that was fine.
        for wait in RATE_LIMIT_WAITS + (None,):
            try:
                with endpoint("/chat/completions", api_key, base_url, payload) as response:
                    result = json.load(response)
                break
            except urllib.error.HTTPError as error:
                if error.code in BUSY_STATUSES and wait is not None:
                    print("        [model busy ({0}), retrying in {1}s]".format(
                        error.code, wait), flush=True)
                    time.sleep(wait)
                    continue
                report_http_error(error)
                break
            except urllib.error.URLError as error:
                sys.stdout.flush()
                print("FAIL  could not reach the endpoint: {0}".format(error.reason), file=sys.stderr)
                break

        if result is None:
            # Drop the turn the model never saw, so the history stays a true
            # record of the conversation it is being sent.
            history.pop()
            continue

        choice = (result.get("choices") or [{}])[0]
        answer = ((choice.get("message") or {}).get("content") or "").strip()
        usage = result.get("usage") or {}
        print("model > " + (answer or "(no content)"))
        print("        [{0:.1f}s, {1} tokens total]".format(
            time.monotonic() - started, usage.get("total_tokens", "?")))
        if choice.get("finish_reason") == "length":
            print("        [cut off - raise --max-tokens]")
        # Only the content goes back. reasoning_content is the model's own
        # scratchpad for one turn, not part of the conversation, and Ask will
        # discard it too.
        history.append({"role": "assistant", "content": answer})


def main():
    parser = argparse.ArgumentParser(
        description="Check that the hosted model behind Ask is reachable and answers.")
    parser.add_argument("--model", default=os.getenv("NVIDIA_MODEL", DEFAULT_MODEL))
    parser.add_argument("--base-url", default=os.getenv("NVIDIA_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--prompt", default=DEFAULT_PROMPT,
                        help="Send something else instead of the default greeting.")
    parser.add_argument("--max-tokens", type=int, default=256)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--stream", action="store_true",
                        help="Use server-sent events instead of one JSON reply.")
    parser.add_argument("--list-models", action="store_true",
                        help="Print every model id this endpoint serves, then stop.")
    parser.add_argument("--chat", action="store_true",
                        help="Interactive back-and-forth instead of one request.")
    arguments = parser.parse_args()

    api_key = (os.getenv("NVIDIA_API_KEY") or "").strip()
    if not api_key:
        print("NVIDIA_API_KEY is not set.", file=sys.stderr)
        print("Add it to the repository root .env file:", file=sys.stderr)
        print("  NVIDIA_API_KEY=nvapi-...", file=sys.stderr)
        print("or set it for one shell only:", file=sys.stderr)
        print('  $env:NVIDIA_API_KEY = "nvapi-..."', file=sys.stderr)
        return 2
    if not api_key.startswith("nvapi-"):
        print("Note: the key does not start with 'nvapi-'; it may be the wrong value.",
              file=sys.stderr)

    try:
        if arguments.list_models:
            return 0 if list_models(api_key, arguments.base_url) else 1

        if arguments.chat:
            # Its own errors are handled per turn, so one bad message does not
            # end the session.
            chat_session(api_key, arguments.base_url, arguments.model,
                         arguments.max_tokens, arguments.temperature)
            return 0

        print("POST {0}/chat/completions".format(arguments.base_url.rstrip("/")))
        print("model {0}, stream {1}".format(arguments.model, arguments.stream))
        print("")
        run = ask_streaming if arguments.stream else ask_once
        answer = run(api_key, arguments.base_url, arguments.model,
                     arguments.prompt, arguments.max_tokens, arguments.temperature)
    except urllib.error.HTTPError as error:
        report_http_error(error)
        return 1
    except urllib.error.URLError as error:
        sys.stdout.flush()
        print("FAIL  the endpoint could not be reached: {0}".format(error.reason), file=sys.stderr)
        print("      Check the network, a proxy, or a firewall blocking {0}".format(
            arguments.base_url), file=sys.stderr)
        return 1

    print("")
    if not answer:
        print("PARTIAL  the call succeeded but the reply was empty.")
        return 1
    print("PASS  reachable, authorised, and the model answered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
