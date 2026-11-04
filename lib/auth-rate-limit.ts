const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

type Attempt = { count: number; firstFailureAt: number };
const globalForRateLimit = globalThis as unknown as {
  loginAttempts?: Map<string, Attempt>;
};
const attempts = globalForRateLimit.loginAttempts ?? new Map<string, Attempt>();
globalForRateLimit.loginAttempts = attempts;

export const LOGIN_RATE_LIMIT_ERROR_CODE = "RATE_LIMITED";

export function isLoginBlocked(email: string, ip: string, now = Date.now()): boolean {
  return [email.toLowerCase(), ip].some((key) => {
    const attempt = attempts.get(key);
    if (!attempt || now - attempt.firstFailureAt >= WINDOW_MS) {
      attempts.delete(key);
      return false;
    }
    return attempt.count >= MAX_FAILED_ATTEMPTS;
  });
}

export function recordLoginFailure(email: string, ip: string, now = Date.now()): void {
  for (const key of [email.toLowerCase(), ip]) {
    const current = attempts.get(key);
    if (!current || now - current.firstFailureAt >= WINDOW_MS) {
      attempts.set(key, { count: 1, firstFailureAt: now });
    } else {
      attempts.set(key, { ...current, count: current.count + 1 });
    }
  }
}

export function clearLoginFailures(email: string, ip: string): void {
  attempts.delete(email.toLowerCase());
  attempts.delete(ip);
}

export function resetLoginRateLimiter(): void {
  attempts.clear();
}
