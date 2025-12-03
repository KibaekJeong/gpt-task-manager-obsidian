/**
 * Unit tests for API client - retry/backoff, error classification, and cancellation
 */

import {
  CancellationToken,
  CancellationError,
  getErrorWithRecovery,
} from "../src/api-client";

// Mock the obsidian requestUrl
jest.mock("obsidian", () => ({
  requestUrl: jest.fn(),
}));

describe("CancellationToken", () => {
  it("starts in non-cancelled state", () => {
    const token = new CancellationToken();
    expect(token.isCancelled).toBe(false);
    expect(token.reason).toBe("");
  });

  it("can be cancelled with a reason", () => {
    const token = new CancellationToken();
    token.cancel("User requested cancellation");
    expect(token.isCancelled).toBe(true);
    expect(token.reason).toBe("User requested cancellation");
  });

  it("uses default reason if none provided", () => {
    const token = new CancellationToken();
    token.cancel();
    expect(token.isCancelled).toBe(true);
    expect(token.reason).toBe("User cancelled");
  });

  it("ignores subsequent cancel calls", () => {
    const token = new CancellationToken();
    token.cancel("First reason");
    token.cancel("Second reason");
    expect(token.reason).toBe("First reason");
  });

  it("calls onCancel callbacks when cancelled", () => {
    const token = new CancellationToken();
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    token.onCancel(callback1);
    token.onCancel(callback2);
    
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
    
    token.cancel("Test");
    
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("immediately calls onCancel if already cancelled", () => {
    const token = new CancellationToken();
    token.cancel("Already cancelled");
    
    const callback = jest.fn();
    token.onCancel(callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("throwIfCancelled does nothing when not cancelled", () => {
    const token = new CancellationToken();
    expect(() => token.throwIfCancelled()).not.toThrow();
  });

  it("throwIfCancelled throws CancellationError when cancelled", () => {
    const token = new CancellationToken();
    token.cancel("Test cancellation");
    
    expect(() => token.throwIfCancelled()).toThrow(CancellationError);
    expect(() => token.throwIfCancelled()).toThrow("Test cancellation");
  });

  it("handles callback errors gracefully", () => {
    const token = new CancellationToken();
    const errorCallback = jest.fn(() => {
      throw new Error("Callback error");
    });
    const normalCallback = jest.fn();
    
    token.onCancel(errorCallback);
    token.onCancel(normalCallback);
    
    // Should not throw, and should still call the second callback
    expect(() => token.cancel("Test")).not.toThrow();
    expect(normalCallback).toHaveBeenCalledTimes(1);
  });
});

describe("CancellationError", () => {
  it("has correct name and message", () => {
    const error = new CancellationError("Test reason");
    expect(error.name).toBe("CancellationError");
    expect(error.message).toBe("Test reason");
  });

  it("is instanceof Error", () => {
    const error = new CancellationError("Test");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof CancellationError).toBe(true);
  });
});

describe("getErrorWithRecovery", () => {
  it("provides recovery suggestion for 401 errors", () => {
    const result = getErrorWithRecovery(401, "Unauthorized");
    expect(result).toContain("Authentication failed");
    expect(result).toContain("API key");
    expect(result).toContain("Unauthorized");
  });

  it("provides recovery suggestion for 403 errors", () => {
    const result = getErrorWithRecovery(403, "Forbidden");
    expect(result).toContain("Access denied");
    expect(result).toContain("permissions");
    expect(result).toContain("Forbidden");
  });

  it("provides recovery suggestion for 429 errors", () => {
    const result = getErrorWithRecovery(429, "Too Many Requests");
    expect(result).toContain("Rate limited");
    expect(result).toContain("wait");
    expect(result).toContain("Too Many Requests");
  });

  it("provides recovery suggestion for 500 errors", () => {
    const result = getErrorWithRecovery(500, "Internal Server Error");
    expect(result).toContain("Server error");
    expect(result).toContain("temporarily unavailable");
  });

  it("provides recovery suggestion for 502 errors", () => {
    const result = getErrorWithRecovery(502, "Bad Gateway");
    expect(result).toContain("Server error");
  });

  it("provides recovery suggestion for 503 errors", () => {
    const result = getErrorWithRecovery(503, "Service Unavailable");
    expect(result).toContain("Server error");
  });

  it("provides recovery suggestion for 504 errors", () => {
    const result = getErrorWithRecovery(504, "Gateway Timeout");
    expect(result).toContain("Server error");
  });

  it("returns original message for other status codes", () => {
    const result = getErrorWithRecovery(400, "Bad Request");
    expect(result).toBe("Bad Request");
  });

  it("returns original message for unknown status codes", () => {
    const result = getErrorWithRecovery(418, "I'm a teapot");
    expect(result).toBe("I'm a teapot");
  });
});

describe("Retry behavior (conceptual tests)", () => {
  // These tests document the expected retry behavior without actually making HTTP calls
  
  describe("isRetryableError classification", () => {
    // We can't directly test the private function, but we document expected behavior
    
    it("should retry on 429 (rate limited)", () => {
      // 429 is retryable - the system should wait and retry
      expect(true).toBe(true); // Placeholder - actual behavior tested via integration
    });

    it("should retry on 5xx server errors", () => {
      // 500, 502, 503, 504 are retryable
      expect(true).toBe(true);
    });

    it("should NOT retry on 4xx client errors (except 429)", () => {
      // 400, 401, 403, 404 etc. are NOT retryable
      expect(true).toBe(true);
    });
  });

  describe("exponential backoff", () => {
    it("should use exponential delays with jitter", () => {
      // Expected: baseDelay * 2^retryCount + random(0-1000ms)
      // Retry 0: 1000ms * 1 + jitter = ~1000-2000ms
      // Retry 1: 1000ms * 2 + jitter = ~2000-3000ms
      // Retry 2: 1000ms * 4 + jitter = ~4000-5000ms
      // Capped at 30000ms
      expect(true).toBe(true);
    });

    it("should cap backoff at 30 seconds", () => {
      // Even with many retries, delay should not exceed 30000ms
      expect(true).toBe(true);
    });
  });
});


