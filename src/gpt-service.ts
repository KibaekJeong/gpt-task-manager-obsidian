import { callOpenAIChatApi, CancellationToken, OpenAIConfig } from "./api-client";
import { logger } from "./logger";

const CATEGORY = "GPTService";

/**
 * Result from GPT API call
 */
export interface GptApiResult {
  success: boolean;
  content: string | null;
  errorMessage: string | null;
  cancelled?: boolean;
}

/**
 * Parsed task suggestion from GPT
 */
export interface TaskSuggestion {
  title: string;
  objective: string;
  importance: string;
  suggestedEpic: string | null;
  suggestedProject: string | null;
  priority: string;
  complexity: string;
  subtasks: string[];
}

/**
 * Parsed task breakdown from GPT
 */
export interface TaskBreakdown {
  tasks: {
    title: string;
    objective: string;
    priority: string;
    dependsOn: number | null;
  }[];
}

/**
 * Prioritization result from GPT
 */
export interface PrioritizationResult {
  prioritizedTasks: {
    title: string;
    suggestedPriority: string;
    reasoning: string;
    suggestedOrder: number;
  }[];
  insights: string;
}

/**
 * Extended options for GPT API calls
 */
export interface GptApiOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutSeconds?: number;
  maxRetries?: number;
  cancellationToken?: CancellationToken;
}

/**
 * Call OpenAI Chat Completions API with timeout, retry, and cancellation support
 */
export async function callGptApi(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model: string,
  maxTokens: number,
  temperature: number,
  cancellationToken?: CancellationToken,
  timeoutSeconds: number = 60,
  maxRetries: number = 3
): Promise<GptApiResult> {
  if (!apiKey) {
    logger.warn(CATEGORY, "No API key configured");
    return { success: false, content: null, errorMessage: "No API key configured" };
  }

  logger.info(CATEGORY, `Calling GPT API`, { model, maxTokens, temperature });

  const config: OpenAIConfig = {
    apiKey,
    model,
    maxTokens,
    temperature,
    timeout: timeoutSeconds * 1000,
    maxRetries,
  };

  const response = await callOpenAIChatApi(
    prompt,
    systemPrompt,
    config,
    cancellationToken
  );

  if (response.cancelled) {
    logger.info(CATEGORY, "GPT API call was cancelled");
    return {
      success: false,
      content: null,
      errorMessage: "Request cancelled",
      cancelled: true,
    };
  }

  if (!response.success) {
    logger.error(CATEGORY, "GPT API call failed", { error: response.error });
    return {
      success: false,
      content: null,
      errorMessage: response.error || "Unknown error",
    };
  }

  const content = response.data?.content;
  if (!content) {
    logger.warn(CATEGORY, "GPT API returned empty content");
    return {
      success: false,
      content: null,
      errorMessage: "Empty response from API",
    };
  }

  logger.info(CATEGORY, `GPT response received`, { contentLength: content.length });
  return { success: true, content, errorMessage: null };
}

/**
 * Call GPT API with options object (for cleaner API)
 */
export async function callGptApiWithOptions(
  prompt: string,
  systemPrompt: string,
  options: GptApiOptions
): Promise<GptApiResult> {
  return callGptApi(
    prompt,
    systemPrompt,
    options.apiKey,
    options.model,
    options.maxTokens,
    options.temperature,
    options.cancellationToken,
    options.timeoutSeconds,
    options.maxRetries
  );
}

/**
 * Extract JSON from GPT response (handles markdown code blocks)
 */
export function extractJsonFromResponse(response: string): string {
  // Try to extract from code block first
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return response;
}

/**
 * Generate a fallback title based on timestamp
 */
function generateFallbackTitle(): string {
  const now = new Date();
  return `Task-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * Ensure title is not empty, with fallback options
 */
function ensureValidTitle(title: string | undefined | null, fallbackSource?: string): string {
  // Try the provided title first
  const trimmedTitle = (title || "").trim();
  if (trimmedTitle.length > 0) {
    return trimmedTitle;
  }
  
  // Try the fallback source (e.g., objective or raw input)
  const trimmedFallback = (fallbackSource || "").trim();
  if (trimmedFallback.length > 0) {
    // Use first 50 chars of fallback as title
    return trimmedFallback.substring(0, 50);
  }
  
  // Generate timestamp-based fallback
  return generateFallbackTitle();
}

/**
 * Parse task suggestion from GPT response
 */
export function parseTaskSuggestion(response: string): TaskSuggestion | null {
  try {
    const jsonStr = extractJsonFromResponse(response);
    const parsed = JSON.parse(jsonStr);

    return {
      title: ensureValidTitle(parsed.title, parsed.objective),
      objective: parsed.objective || "",
      importance: parsed.importance || "",
      suggestedEpic: parsed.suggestedEpic || null,
      suggestedProject: parsed.suggestedProject || null,
      priority: parsed.priority || "medium",
      complexity: parsed.complexity || "moderate",
      subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
    };
  } catch (error) {
    console.error("[GPT Task Manager] Failed to parse task suggestion:", error);
    return null;
  }
}

/**
 * Parse task breakdown from GPT response
 */
export function parseTaskBreakdown(response: string): TaskBreakdown | null {
  try {
    const jsonStr = extractJsonFromResponse(response);
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed.tasks)) {
      return null;
    }

    return {
      tasks: parsed.tasks.map((task: {
        title?: string;
        objective?: string;
        priority?: string;
        dependsOn?: number | null;
      }, taskIndex: number) => ({
        title: ensureValidTitle(task.title, task.objective) || `Subtask-${taskIndex + 1}`,
        objective: task.objective || "",
        priority: task.priority || "medium",
        dependsOn: task.dependsOn ?? null,
      })),
    };
  } catch (error) {
    console.error("[GPT Task Manager] Failed to parse task breakdown:", error);
    return null;
  }
}

/**
 * Parse prioritization result from GPT response
 */
export function parsePrioritizationResult(response: string): PrioritizationResult | null {
  try {
    const jsonStr = extractJsonFromResponse(response);
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed.prioritizedTasks)) {
      return null;
    }

    return {
      prioritizedTasks: parsed.prioritizedTasks.map((task: {
        title?: string;
        suggestedPriority?: string;
        reasoning?: string;
        suggestedOrder?: number;
      }) => ({
        title: task.title || "",
        suggestedPriority: task.suggestedPriority || "medium",
        reasoning: task.reasoning || "",
        suggestedOrder: task.suggestedOrder || 0,
      })),
      insights: parsed.insights || "",
    };
  } catch (error) {
    console.error("[GPT Task Manager] Failed to parse prioritization result:", error);
    return null;
  }
}

/**
 * Fill template placeholders with actual values
 * Uses function replacer to avoid issues with $ and \ in replacement strings
 */
export function fillPromptTemplate(
  template: string,
  values: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    // Use function replacer to avoid special replacement patterns like $& or $1
    // This ensures text containing $ or \ (e.g., "Pay $500") is not mangled
    result = result.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, "g"),
      () => value
    );
  }
  return result;
}

