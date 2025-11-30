/**
 * API client with timeout, retry/backoff, cancellation, and rate limiting
 */

import { requestUrl, RequestUrlResponse } from "obsidian";
import { logger, scopeTextForApi } from "./logger";

const CATEGORY = "APIClient";

/**
 * API request configuration
 */
export interface ApiRequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
  statusCode: number;
  retryCount: number;
  cancelled: boolean;
}

/**
 * Cancellation token for aborting requests
 */
export class CancellationToken {
  private _isCancelled: boolean = false;
  private _reason: string = "";
  private _callbacks: (() => void)[] = [];

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  get reason(): string {
    return this._reason;
  }

  cancel(reason: string = "User cancelled"): void {
    if (this._isCancelled) return;
    this._isCancelled = true;
    this._reason = reason;
    for (const callback of this._callbacks) {
      try {
        callback();
      } catch {
        // Ignore callback errors
      }
    }
  }

  onCancel(callback: () => void): void {
    if (this._isCancelled) {
      callback();
    } else {
      this._callbacks.push(callback);
    }
  }

  throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new CancellationError(this._reason);
    }
  }
}

/**
 * Error thrown when request is cancelled
 */
export class CancellationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "CancellationError";
  }
}

/**
 * Rate limiter to prevent API abuse
 */
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    this.cleanup();
    if (this.requests.length < this.maxRequests) {
      return 0;
    }
    const oldestRequest = this.requests[0];
    return oldestRequest + this.windowMs - Date.now();
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
  }
}

// Global rate limiter instance (10 requests per minute by default)
const rateLimiter = new RateLimiter(10, 60000);

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(retryCount: number, baseDelayMs: number): number {
  // Exponential backoff: baseDelay * 2^retryCount + jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

/**
 * Check if error is retryable
 */
function isRetryableError(statusCode: number): boolean {
  // 429 = Rate limited, 5xx = Server errors
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * Extract error message from response
 */
function extractErrorMessage(response: RequestUrlResponse): string {
  try {
    const body = response.json || response.text;
    if (typeof body === "object" && body?.error?.message) {
      return body.error.message;
    }
    if (typeof body === "string" && body.length < 200) {
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error?.message) {
          return parsed.error.message;
        }
      } catch {
        return body;
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return `HTTP ${response.status}`;
}

/**
 * Get user-friendly error message with recovery suggestion
 */
export function getErrorWithRecovery(statusCode: number, message: string): string {
  switch (statusCode) {
    case 401:
      return `Authentication failed: ${message}. Please check your API key in settings.`;
    case 403:
      return `Access denied: ${message}. Your API key may lack required permissions.`;
    case 429:
      return `Rate limited: ${message}. Please wait a moment before trying again.`;
    case 500:
    case 502:
    case 503:
    case 504:
      return `Server error: ${message}. The API is temporarily unavailable. Please try again later.`;
    default:
      return message;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an API request with timeout, retry, and cancellation support
 */
export async function makeApiRequest<T = unknown>(
  config: ApiRequestConfig,
  cancellationToken?: CancellationToken
): Promise<ApiResponse<T>> {
  const {
    url,
    method,
    headers = {},
    body,
    timeout = 30000,
    maxRetries = 3,
    retryDelayMs = 1000,
  } = config;

  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getWaitTime();
    logger.warn(CATEGORY, `Rate limit reached, need to wait ${waitTime}ms`);
    return {
      success: false,
      data: null,
      error: `Rate limited. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
      statusCode: 429,
      retryCount: 0,
      cancelled: false,
    };
  }

  let retryCount = 0;
  let lastError = "";
  let lastStatusCode = 0;

  while (retryCount <= maxRetries) {
    // Check cancellation
    if (cancellationToken?.isCancelled) {
      logger.info(CATEGORY, "Request cancelled by user");
      return {
        success: false,
        data: null,
        error: cancellationToken.reason,
        statusCode: 0,
        retryCount,
        cancelled: true,
      };
    }

    try {
      logger.debug(CATEGORY, `Making request attempt ${retryCount + 1}/${maxRetries + 1}`, {
        url,
        method,
        timeout,
      });

      // Record the request for rate limiting
      rateLimiter.recordRequest();

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), timeout);
      });

      // Create request promise
      const requestPromise = requestUrl({
        url,
        method,
        headers,
        body,
        throw: false,
      });

      // Race between request and timeout
      const response = await Promise.race([requestPromise, timeoutPromise]) as RequestUrlResponse;

      lastStatusCode = response.status;

      // Check for success
      if (response.status >= 200 && response.status < 300) {
        logger.info(CATEGORY, `Request successful`, { statusCode: response.status });
        return {
          success: true,
          data: response.json as T,
          error: null,
          statusCode: response.status,
          retryCount,
          cancelled: false,
        };
      }

      // Extract error message
      lastError = extractErrorMessage(response);
      logger.warn(CATEGORY, `Request failed`, { statusCode: response.status, error: lastError });

      // Check if we should retry
      if (isRetryableError(response.status) && retryCount < maxRetries) {
        const delay = calculateBackoffDelay(retryCount, retryDelayMs);
        logger.info(CATEGORY, `Retrying in ${delay}ms (attempt ${retryCount + 2}/${maxRetries + 1})`);
        
        // Wait with cancellation check
        const startWait = Date.now();
        while (Date.now() - startWait < delay) {
          if (cancellationToken?.isCancelled) {
            return {
              success: false,
              data: null,
              error: cancellationToken.reason,
              statusCode: 0,
              retryCount,
              cancelled: true,
            };
          }
          await sleep(100);
        }
        
        retryCount++;
        continue;
      }

      // Non-retryable error or max retries reached
      break;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      lastError = errorMessage;
      
      logger.error(CATEGORY, `Request exception`, { error: errorMessage });

      if (errorMessage === "Request timeout" && retryCount < maxRetries) {
        const delay = calculateBackoffDelay(retryCount, retryDelayMs);
        logger.info(CATEGORY, `Timeout, retrying in ${delay}ms`);
        await sleep(delay);
        retryCount++;
        continue;
      }

      break;
    }
  }

  const finalError = getErrorWithRecovery(lastStatusCode, lastError);
  return {
    success: false,
    data: null,
    error: finalError,
    statusCode: lastStatusCode,
    retryCount,
    cancelled: false,
  };
}

/**
 * OpenAI-specific API client configuration
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Call OpenAI Chat Completions API with all safety features
 */
export async function callOpenAIChatApi(
  prompt: string,
  systemPrompt: string,
  config: OpenAIConfig,
  cancellationToken?: CancellationToken
): Promise<ApiResponse<{ content: string }>> {
  // Scope and sanitize the prompt
  const scopedPrompt = scopeTextForApi(prompt, 8000);
  const scopedSystem = scopeTextForApi(systemPrompt, 2000);

  const response = await makeApiRequest<{
    choices: { message: { content: string } }[];
  }>({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: scopedSystem },
        { role: "user", content: scopedPrompt },
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
    timeout: config.timeout || 60000,
    maxRetries: config.maxRetries || 3,
  }, cancellationToken);

  if (!response.success) {
    return {
      ...response,
      data: null,
    };
  }

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      success: false,
      data: null,
      error: "Empty response from API",
      statusCode: response.statusCode,
      retryCount: response.retryCount,
      cancelled: false,
    };
  }

  return {
    success: true,
    data: { content },
    error: null,
    statusCode: response.statusCode,
    retryCount: response.retryCount,
    cancelled: false,
  };
}

/**
 * Call OpenAI Whisper API for transcription
 */
export async function callWhisperApi(
  audioBlob: Blob,
  apiKey: string,
  model: string = "whisper-1",
  language?: string,
  cancellationToken?: CancellationToken
): Promise<ApiResponse<{ text: string }>> {
  // Check cancellation before starting
  if (cancellationToken?.isCancelled) {
    return {
      success: false,
      data: null,
      error: cancellationToken.reason,
      statusCode: 0,
      retryCount: 0,
      cancelled: true,
    };
  }

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", model);
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  // Note: FormData requests need different handling
  // Using fetch directly for multipart/form-data
  try {
    const controller = new AbortController();
    
    // Setup cancellation
    cancellationToken?.onCancel(() => {
      controller.abort();
    });

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson?.error?.message || errorMessage;
      } catch {
        if (errorText.length < 200) {
          errorMessage = errorText;
        }
      }

      return {
        success: false,
        data: null,
        error: getErrorWithRecovery(response.status, errorMessage),
        statusCode: response.status,
        retryCount: 0,
        cancelled: false,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: { text: data.text },
      error: null,
      statusCode: response.status,
      retryCount: 0,
      cancelled: false,
    };

  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        data: null,
        error: "Request cancelled",
        statusCode: 0,
        retryCount: 0,
        cancelled: true,
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(CATEGORY, "Whisper API error", { error: errorMessage });

    return {
      success: false,
      data: null,
      error: errorMessage,
      statusCode: 0,
      retryCount: 0,
      cancelled: false,
    };
  }
}

/**
 * Update rate limiter configuration
 */
export function setRateLimitConfig(maxRequests: number, windowMs: number): void {
  Object.assign(rateLimiter, new RateLimiter(maxRequests, windowMs));
}

