import { requestUrl, RequestUrlResponse } from "obsidian";

/**
 * Result from GPT API call
 */
export interface GptApiResult {
  success: boolean;
  content: string | null;
  errorMessage: string | null;
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
 * Call OpenAI Chat Completions API
 */
export async function callGptApi(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model: string,
  maxTokens: number,
  temperature: number
): Promise<GptApiResult> {
  if (!apiKey) {
    return { success: false, content: null, errorMessage: "No API key configured" };
  }

  try {
    console.log(`[GPT Task Manager] Calling GPT API with model: ${model}`);

    const response: RequestUrlResponse = await requestUrl({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature: temperature,
      }),
      throw: false,
    });

    if (response.status !== 200) {
      let errorMessage = `API error (${response.status})`;
      const errorBody = response.text || response.json;

      if (typeof errorBody === "string") {
        try {
          const parsed = JSON.parse(errorBody);
          errorMessage = parsed?.error?.message || errorMessage;
        } catch {
          if (errorBody.length < 200) {
            errorMessage = errorBody;
          }
        }
      } else if (errorBody?.error?.message) {
        errorMessage = errorBody.error.message;
      }

      console.error(`[GPT Task Manager] GPT API error: ${response.status}`, errorBody);
      return { success: false, content: null, errorMessage };
    }

    const data = response.json;
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, content: null, errorMessage: "Empty response from API" };
    }

    console.log(`[GPT Task Manager] GPT response received: ${content.length} chars`);
    return { success: true, content, errorMessage: null };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[GPT Task Manager] GPT API call failed:", error);
    return { success: false, content: null, errorMessage: errorMsg };
  }
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
 * Parse task suggestion from GPT response
 */
export function parseTaskSuggestion(response: string): TaskSuggestion | null {
  try {
    const jsonStr = extractJsonFromResponse(response);
    const parsed = JSON.parse(jsonStr);

    return {
      title: parsed.title || "",
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
      }) => ({
        title: task.title || "",
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
 */
export function fillPromptTemplate(
  template: string,
  values: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

