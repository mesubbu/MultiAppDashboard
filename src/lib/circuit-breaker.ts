type CircuitBreakerState = {
  consecutiveFailures: number;
  openedAt?: number;
};

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  shouldTrip?: (error: unknown) => boolean;
};

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RESET_TIMEOUT_MS = 30_000;

export const CONTROL_PLANE_REMOTE_CIRCUIT_KEY = 'dashboard:control-plane-remote';
export const AI_GATEWAY_REMOTE_CIRCUIT_KEY = 'dashboard:ai-gateway-remote';

declare global {
  var __dashboardCircuitBreakers: Map<string, CircuitBreakerState> | undefined;
}

function getCircuitBreakers() {
  if (!globalThis.__dashboardCircuitBreakers) {
    globalThis.__dashboardCircuitBreakers = new Map();
  }

  return globalThis.__dashboardCircuitBreakers;
}

function getState(key: string) {
  const store = getCircuitBreakers();
  const state = store.get(key) ?? { consecutiveFailures: 0 };
  store.set(key, state);
  return state;
}

function resetState(key: string) {
  getCircuitBreakers().set(key, { consecutiveFailures: 0 });
}

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly key: string,
    public readonly retryAfterMs: number,
  ) {
    super(`Circuit breaker for ${key} is open. Retry in ${Math.max(1, Math.ceil(retryAfterMs / 1000))}s.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export async function runWithCircuitBreaker<T>(
  key: string,
  operation: () => Promise<T>,
  options: CircuitBreakerOptions = {},
): Promise<T> {
  const failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  const shouldTrip = options.shouldTrip ?? (() => true);
  const now = Date.now();
  const state = getState(key);

  if (state.openedAt) {
    const elapsedMs = now - state.openedAt;
    if (elapsedMs < resetTimeoutMs) {
      throw new CircuitBreakerOpenError(key, resetTimeoutMs - elapsedMs);
    }

    state.openedAt = undefined;
  }

  try {
    const result = await operation();
    resetState(key);
    return result;
  } catch (error) {
    if (!shouldTrip(error)) {
      throw error;
    }

    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= failureThreshold) {
      state.openedAt = Date.now();
    }

    throw error;
  }
}

export function resetCircuitBreakersForTests() {
  globalThis.__dashboardCircuitBreakers = undefined;
}

