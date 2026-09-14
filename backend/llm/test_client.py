"""Tests for how one failed HTTP call is described to the person who caused it.

Every message in this module is shown to a user, and a wrong one sends them to
fix something that was never broken - which is exactly what happened before the
timeout branch existed: a model that was merely slow was reported as an
unreachable one, and the advice was to check a working internet connection.

None of these make a network call. urlopen is replaced, because what is being
tested is the translation from an exception to a sentence.

Run from the repository root:
    .venv\\Scripts\\python.exe -m pytest backend/llm/test_client.py -q
"""

import json
import urllib.error

import pytest

from llm import client


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    """A key and a model, so no test trips over the configuration check."""
    monkeypatch.setenv("NVIDIA_API_KEY", "nvapi-test")
    monkeypatch.setenv("NVIDIA_MODEL", "test/model")
    monkeypatch.setenv("NVIDIA_BASE_URL", "https://example.invalid/v1")


def raising(error):
    """An urlopen that fails the same way every time."""

    def urlopen(*args, **kwargs):
        raise error

    return urlopen


def http_error(code, body=None):
    import io

    payload = json.dumps(body or {}).encode("utf-8")
    return urllib.error.HTTPError(
        "https://example.invalid/v1/chat/completions",
        code,
        "boom",
        {},
        io.BytesIO(payload),
    )


# --------------------------------------------------------------------------
# Timeouts
# --------------------------------------------------------------------------


def test_a_timeout_is_not_reported_as_a_broken_connection(monkeypatch):
    """The request arrived; the answer was slow. Two different problems."""
    monkeypatch.setattr(client.urllib.request, "urlopen", raising(TimeoutError()))

    with pytest.raises(client.LLMUnavailable) as raised:
        client.chat("system", "user", timeout=90)

    assert "90 seconds" in str(raised.value)
    assert "internet connection" not in str(raised.value)


def test_a_timeout_wrapped_in_urlerror_is_read_the_same_way(monkeypatch):
    """urlopen wraps it when the wait was for the connection, not the reply."""
    monkeypatch.setattr(
        client.urllib.request,
        "urlopen",
        raising(urllib.error.URLError(TimeoutError())),
    )

    with pytest.raises(client.LLMUnavailable) as raised:
        client.chat("system", "user", timeout=30)

    assert "30 seconds" in str(raised.value)
    assert "try again" in str(raised.value)


def test_a_refused_connection_still_says_to_check_the_connection(monkeypatch):
    monkeypatch.setattr(
        client.urllib.request,
        "urlopen",
        raising(urllib.error.URLError(ConnectionRefusedError())),
    )

    with pytest.raises(client.LLMUnavailable) as raised:
        client.chat("system", "user")

    assert "internet connection" in str(raised.value)


# --------------------------------------------------------------------------
# Statuses
# --------------------------------------------------------------------------


def test_a_rejected_key_names_the_setting_to_fix(monkeypatch):
    monkeypatch.setattr(client.urllib.request, "urlopen", raising(http_error(401)))

    with pytest.raises(client.LLMNotConfigured) as raised:
        client.chat("system", "user")

    assert "NVIDIA_API_KEY" in str(raised.value)


def test_an_unserved_model_names_itself(monkeypatch):
    """The one the free endpoint produces when it stops serving a model."""
    monkeypatch.setattr(client.urllib.request, "urlopen", raising(http_error(404)))

    with pytest.raises(client.LLMNotConfigured) as raised:
        client.chat("system", "user")

    assert "test/model" in str(raised.value)
    assert "NVIDIA_MODEL" in str(raised.value)


def test_the_endpoints_own_words_survive(monkeypatch):
    """Dropping the body turns every distinct failure into the same shrug."""
    monkeypatch.setattr(
        client.urllib.request,
        "urlopen",
        raising(http_error(404, {"detail": "model not entitled"})),
    )

    with pytest.raises(client.LLMNotConfigured) as raised:
        client.chat("system", "user")

    assert "model not entitled" in str(raised.value)


@pytest.mark.parametrize("status", client.BUSY_STATUSES)
def test_a_busy_endpoint_is_retried_then_given_up_on(monkeypatch, status):
    calls = []

    def urlopen(*args, **kwargs):
        calls.append(1)
        raise http_error(status)

    monkeypatch.setattr(client.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(client.time, "sleep", lambda seconds: None)

    with pytest.raises(client.LLMRateLimited):
        client.chat("system", "user")

    assert len(calls) == len(client.RATE_LIMIT_WAITS) + 1


def test_a_busy_endpoint_that_recovers_is_not_an_error(monkeypatch):
    """The retry exists to turn a refused burst into an answer, not a message."""
    import io

    attempts = []

    def urlopen(*args, **kwargs):
        attempts.append(1)
        if len(attempts) == 1:
            raise http_error(429)
        return io.BytesIO(
            json.dumps(
                {
                    "choices": [
                        {"message": {"content": "Here it is."}, "finish_reason": "stop"}
                    ]
                }
            ).encode("utf-8")
        )

    monkeypatch.setattr(client.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(client.time, "sleep", lambda seconds: None)

    assert client.chat("system", "user") == "Here it is."
    assert len(attempts) == 2


def test_no_key_is_its_own_message(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "")

    with pytest.raises(client.LLMNotConfigured) as raised:
        client.chat("system", "user")

    assert "NVIDIA_API_KEY" in str(raised.value)
