"""The one place that talks to a language model.

Everything model-shaped in the backend goes through client.chat(). Features
differ in their prompts, not in how the request is made, so the key, the
timeout, the retry on a busy endpoint and the error vocabulary live here once.
"""
