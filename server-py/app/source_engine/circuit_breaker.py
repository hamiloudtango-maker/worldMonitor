"""
Per-source circuit breaker with stale-while-revalidate.
States: closed (normal) → open (failing, serve stale) → half-open (testing)
"""

import time
from dataclasses import dataclass, field
from enum import Enum


class State(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreaker:
    max_failures: int = 3
    cooldown_seconds: float = 300  # 5 min

    _failure_count: int = field(default=0, init=False)
    _state: State = field(default=State.CLOSED, init=False)
    _last_failure_at: float = field(default=0, init=False)

    @property
    def state(self) -> State:
        if self._state == State.OPEN:
            if time.time() - self._last_failure_at > self.cooldown_seconds:
                self._state = State.HALF_OPEN
        return self._state

    @property
    def is_allowed(self) -> bool:
        """Whether a request is allowed through."""
        s = self.state
        return s in (State.CLOSED, State.HALF_OPEN)

    def record_success(self) -> None:
        self._failure_count = 0
        self._state = State.CLOSED

    def record_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_at = time.time()
        if self._failure_count >= self.max_failures:
            self._state = State.OPEN


@dataclass
class CircuitBreakerRegistry:
    """Manages circuit breakers per source_id."""

    _breakers: dict[str, CircuitBreaker] = field(default_factory=dict)

    def get(self, source_id: str) -> CircuitBreaker:
        if source_id not in self._breakers:
            self._breakers[source_id] = CircuitBreaker()
        return self._breakers[source_id]

    def remove(self, source_id: str) -> None:
        self._breakers.pop(source_id, None)


# Global singleton
breaker_registry = CircuitBreakerRegistry()
