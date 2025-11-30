/**
 * Unit tests for GPT service parsing functions
 */

import {
  extractJsonFromResponse,
  parseTaskSuggestion,
  parseTaskBreakdown,
  fillPromptTemplate,
} from "../src/gpt-service";

describe("extractJsonFromResponse", () => {
  it("extracts JSON from code block with json tag", () => {
    const response = '```json\n{"title": "Test"}\n```';
    expect(extractJsonFromResponse(response)).toBe('{"title": "Test"}');
  });

  it("extracts JSON from code block without tag", () => {
    const response = '```\n{"title": "Test"}\n```';
    expect(extractJsonFromResponse(response)).toBe('{"title": "Test"}');
  });

  it("extracts raw JSON object", () => {
    const response = 'Here is the result: {"title": "Test", "priority": "high"}';
    expect(extractJsonFromResponse(response)).toBe('{"title": "Test", "priority": "high"}');
  });

  it("returns original response if no JSON found", () => {
    const response = "No JSON here";
    expect(extractJsonFromResponse(response)).toBe("No JSON here");
  });
});

describe("parseTaskSuggestion", () => {
  it("parses valid task suggestion", () => {
    const response = JSON.stringify({
      title: "Test Task",
      objective: "Test objective",
      importance: "Very important",
      suggestedEpic: "Test Epic",
      suggestedProject: "Test Project",
      priority: "high",
      complexity: "moderate",
      subtasks: ["Subtask 1", "Subtask 2"],
    });

    const result = parseTaskSuggestion(response);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Test Task");
    expect(result?.priority).toBe("high");
    expect(result?.subtasks).toHaveLength(2);
  });

  it("handles missing fields with defaults", () => {
    const response = JSON.stringify({
      title: "Minimal Task",
    });

    const result = parseTaskSuggestion(response);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Minimal Task");
    expect(result?.priority).toBe("medium");
    expect(result?.complexity).toBe("moderate");
    expect(result?.subtasks).toEqual([]);
  });

  it("generates fallback title from objective", () => {
    const response = JSON.stringify({
      title: "",
      objective: "This is the objective for the task",
    });

    const result = parseTaskSuggestion(response);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("This is the objective for the task");
  });

  it("generates timestamp fallback when both title and objective empty", () => {
    const response = JSON.stringify({
      title: "",
      objective: "",
    });

    const result = parseTaskSuggestion(response);
    expect(result).not.toBeNull();
    expect(result?.title).toMatch(/^Task-\d{8}-\d{4}$/);
  });

  it("returns null for invalid JSON", () => {
    const response = "not valid json";
    const result = parseTaskSuggestion(response);
    expect(result).toBeNull();
  });
});

describe("parseTaskBreakdown", () => {
  it("parses valid task breakdown", () => {
    const response = JSON.stringify({
      tasks: [
        { title: "Task 1", objective: "Objective 1", priority: "high", dependsOn: null },
        { title: "Task 2", objective: "Objective 2", priority: "medium", dependsOn: 0 },
        { title: "Task 3", objective: "Objective 3", priority: "low", dependsOn: 1 },
      ],
    });

    const result = parseTaskBreakdown(response);
    expect(result).not.toBeNull();
    expect(result?.tasks).toHaveLength(3);
    expect(result?.tasks[0].dependsOn).toBeNull();
    expect(result?.tasks[1].dependsOn).toBe(0);
    expect(result?.tasks[2].dependsOn).toBe(1);
  });

  it("handles missing task fields", () => {
    const response = JSON.stringify({
      tasks: [
        { title: "Task 1" },
        {},
      ],
    });

    const result = parseTaskBreakdown(response);
    expect(result).not.toBeNull();
    expect(result?.tasks[0].title).toBe("Task 1");
    expect(result?.tasks[0].priority).toBe("medium");
    expect(result?.tasks[1].title).toMatch(/^Subtask-2|Task-\d+/);
  });

  it("returns null when tasks is not an array", () => {
    const response = JSON.stringify({ tasks: "not an array" });
    const result = parseTaskBreakdown(response);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseTaskBreakdown("invalid");
    expect(result).toBeNull();
  });
});

describe("fillPromptTemplate", () => {
  it("replaces simple placeholders", () => {
    const template = "Hello {{name}}, welcome to {{place}}!";
    const result = fillPromptTemplate(template, { name: "Alice", place: "Wonderland" });
    expect(result).toBe("Hello Alice, welcome to Wonderland!");
  });

  it("handles multiple occurrences of same placeholder", () => {
    const template = "{{name}} said hello. Hello {{name}}!";
    const result = fillPromptTemplate(template, { name: "Bob" });
    expect(result).toBe("Bob said hello. Hello Bob!");
  });

  it("preserves $ characters in replacement values", () => {
    const template = "Task: {{description}}";
    const result = fillPromptTemplate(template, { description: "Pay $500 for item" });
    expect(result).toBe("Task: Pay $500 for item");
  });

  it("preserves backslash characters in replacement values", () => {
    const template = "Path: {{path}}";
    const result = fillPromptTemplate(template, { path: "C:\\Users\\Documents" });
    expect(result).toBe("Path: C:\\Users\\Documents");
  });

  it("handles special regex characters safely", () => {
    const template = "Input: {{input}}";
    const result = fillPromptTemplate(template, { input: "$& $` $' $$" });
    expect(result).toBe("Input: $& $` $' $$");
  });

  it("leaves unmatched placeholders unchanged", () => {
    const template = "Hello {{name}}, your ID is {{id}}";
    const result = fillPromptTemplate(template, { name: "Charlie" });
    expect(result).toBe("Hello Charlie, your ID is {{id}}");
  });
});

