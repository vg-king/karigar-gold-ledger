import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLoginFailures,
  isLoginBlocked,
  LOGIN_RATE_LIMIT_ERROR_CODE,
  recordLoginFailure,
  resetLoginRateLimiter,
} from "./auth-rate-limit";

describe("login rate limiter", () => {
  beforeEach(() => resetLoginRateLimiter());

  it("blocks an email after five failures and clears on success", () => {
    for (let count = 0; count < 5; count += 1) {
      recordLoginFailure("clerk@example.com", "127.0.0.1", 1000 + count);
    }
    expect(isLoginBlocked("clerk@example.com", "127.0.0.1", 2000)).toBe(true);
    clearLoginFailures("clerk@example.com", "127.0.0.1");
    expect(isLoginBlocked("clerk@example.com", "127.0.0.1", 2000)).toBe(false);
  });

  it("expires failures after the fifteen-minute window", () => {
    recordLoginFailure("clerk@example.com", "127.0.0.1", 1000);
    expect(isLoginBlocked("clerk@example.com", "127.0.0.1", 15 * 60 * 1000 + 1001)).toBe(false);
  });

  it("uses the dedicated rate-limit error code", () => {
    expect(LOGIN_RATE_LIMIT_ERROR_CODE).toBe("RATE_LIMITED");
  });
});
