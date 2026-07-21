from abc import ABC, abstractmethod


class ChatProvider(ABC):
    """Thin wrapper so pipeline code never imports litellm types directly —
    keeps the door open to hand-roll a provider later and keeps tests using
    simple fakes instead of hitting a real API."""

    @abstractmethod
    def complete(self, messages: list[dict], *, system: str | None = None, max_tokens: int = 1024) -> str: ...


class LiteLLMChatProvider(ChatProvider):
    def __init__(self, model: str, api_key: str | None = None, base_url: str | None = None):
        self.model = model
        # Passed explicitly rather than relying on litellm's os.environ
        # lookup: pydantic-settings loads .env into our Settings object but
        # does not export those values into the process environment, so a
        # key living only in .env would otherwise be invisible to litellm.
        self.api_key = api_key
        self.base_url = base_url

    # Aggregator proxies (omniroute) route each call to a free-tier backend
    # that's sometimes dead, returning a transient 400 "Invalid model". litellm
    # treats 400 as non-retryable, so we retry here — and when a whole selector
    # (e.g. auto/best-fast) is having a bad spell, fall back to sibling
    # selectors whose backend pools may be healthy.
    _RETRIES_PER_MODEL = 2
    _AUTO_FALLBACKS = ("auto/best-chat", "auto/best-reasoning", "auto/best-coding")

    def _candidate_models(self) -> list[str]:
        candidates = [self.model]
        # Only expand for omniroute-style "auto/*" selectors.
        if "auto/" in self.model:
            prefix = self.model.rsplit("/", 1)[0]  # e.g. "openai/auto" -> keep "openai/"
            base = prefix.rsplit("/", 1)[0] if "/" in prefix else ""
            for alt in self._AUTO_FALLBACKS:
                model = f"{base}/{alt}" if base else alt
                if model not in candidates:
                    candidates.append(model)
        return candidates

    def complete(self, messages: list[dict], *, system: str | None = None, max_tokens: int = 1024) -> str:
        import time

        import litellm

        full_messages = list(messages)
        if system is not None:
            full_messages = [{"role": "system", "content": system}, *full_messages]
        kwargs = {"messages": full_messages, "max_tokens": max_tokens}
        if self.api_key:
            kwargs["api_key"] = self.api_key
        if self.base_url:
            kwargs["api_base"] = self.base_url

        last_err: Exception | None = None
        for model in self._candidate_models():
            for attempt in range(self._RETRIES_PER_MODEL):
                try:
                    response = litellm.completion(model=model, **kwargs)
                    return response.choices[0].message.content
                except Exception as exc:  # noqa: BLE001 — retry / fall back on any hiccup
                    last_err = exc
                    time.sleep(0.8 * (attempt + 1))
        raise last_err  # type: ignore[misc]
