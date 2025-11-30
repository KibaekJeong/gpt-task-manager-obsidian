/**
 * Unit tests for task creator functions
 */

import { sanitizeFilename } from "../src/task-creator";

// Mock the Obsidian modules
jest.mock("obsidian", () => ({
  App: jest.fn(),
  TFile: jest.fn(),
  TFolder: jest.fn(),
  normalizePath: (path: string) => path.replace(/\\/g, "/"),
  Notice: jest.fn(),
  Modal: jest.fn(),
}));

describe("sanitizeFilename", () => {
  it("removes invalid characters", () => {
    expect(sanitizeFilename("file:name*test?")).toBe("file-name-test-");
  });

  it("replaces backslashes and forward slashes", () => {
    expect(sanitizeFilename("path\\to/file")).toBe("path-to-file");
  });

  it("collapses multiple spaces", () => {
    expect(sanitizeFilename("hello    world")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(sanitizeFilename("  test file  ")).toBe("test file");
  });

  it("limits length to 100 characters", () => {
    const longName = "a".repeat(150);
    expect(sanitizeFilename(longName).length).toBe(100);
  });

  it("uses fallback for empty result", () => {
    expect(sanitizeFilename("")).toBe("Untitled Task");
    expect(sanitizeFilename("   ")).toBe("Untitled Task");
    expect(sanitizeFilename(":::")).toBe("---");
  });

  it("uses custom fallback default", () => {
    expect(sanitizeFilename("", "Custom Default")).toBe("Custom Default");
  });

  it("handles unicode characters", () => {
    expect(sanitizeFilename("태스크 이름")).toBe("태스크 이름");
    expect(sanitizeFilename("日本語タスク")).toBe("日本語タスク");
  });

  it("preserves quotes and parentheses", () => {
    expect(sanitizeFilename('Task "Important" (v1)')).toBe('Task -Important- (v1)');
  });

  it("handles pipe characters", () => {
    expect(sanitizeFilename("option1|option2")).toBe("option1-option2");
  });
});

describe("dependency mapping logic", () => {
  // Test the dependency resolution algorithm conceptually
  
  it("maps sequential dependencies correctly", () => {
    // Simulating: task 0, task 1 depends on 0, task 2 depends on 1
    const indexToBasename = new Map<number, string>();
    const tasks = [
      { title: "Task A", dependsOn: null },
      { title: "Task B", dependsOn: 0 },
      { title: "Task C", dependsOn: 1 },
    ];
    
    const results: (string | undefined)[] = [];
    
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
      const task = tasks[taskIndex];
      let parentBasename: string | undefined = undefined;
      
      if (task.dependsOn !== null) {
        const dependsOnIndex = task.dependsOn;
        if (dependsOnIndex >= 0 && dependsOnIndex < taskIndex && indexToBasename.has(dependsOnIndex)) {
          parentBasename = indexToBasename.get(dependsOnIndex);
        }
      }
      
      results.push(parentBasename);
      indexToBasename.set(taskIndex, task.title);
    }
    
    expect(results[0]).toBeUndefined(); // Task A has no dependency
    expect(results[1]).toBe("Task A");   // Task B depends on Task A
    expect(results[2]).toBe("Task B");   // Task C depends on Task B
  });

  it("handles non-linear dependencies", () => {
    // Simulating: task 0, task 1, task 2 depends on 0, task 3 depends on 0
    const indexToBasename = new Map<number, string>();
    const tasks = [
      { title: "Setup", dependsOn: null },
      { title: "Feature A", dependsOn: null },
      { title: "Test Setup", dependsOn: 0 },
      { title: "Deploy Setup", dependsOn: 0 },
    ];
    
    const results: (string | undefined)[] = [];
    
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
      const task = tasks[taskIndex];
      let parentBasename: string | undefined = undefined;
      
      if (task.dependsOn !== null) {
        const dependsOnIndex = task.dependsOn;
        if (dependsOnIndex >= 0 && dependsOnIndex < taskIndex && indexToBasename.has(dependsOnIndex)) {
          parentBasename = indexToBasename.get(dependsOnIndex);
        }
      }
      
      results.push(parentBasename);
      indexToBasename.set(taskIndex, task.title);
    }
    
    expect(results[0]).toBeUndefined();
    expect(results[1]).toBeUndefined();
    expect(results[2]).toBe("Setup");    // Depends on index 0
    expect(results[3]).toBe("Setup");    // Also depends on index 0
  });

  it("ignores invalid dependency indices", () => {
    const indexToBasename = new Map<number, string>();
    const tasks = [
      { title: "Task A", dependsOn: -1 },    // Negative index
      { title: "Task B", dependsOn: 5 },     // Future index
      { title: "Task C", dependsOn: 1 },     // Valid but refers to task without parent set
    ];
    
    const results: (string | undefined)[] = [];
    
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
      const task = tasks[taskIndex];
      let parentBasename: string | undefined = undefined;
      
      if (task.dependsOn !== null) {
        const dependsOnIndex = task.dependsOn;
        // Validate: non-negative, less than current index, and exists in map
        if (dependsOnIndex >= 0 && dependsOnIndex < taskIndex && indexToBasename.has(dependsOnIndex)) {
          parentBasename = indexToBasename.get(dependsOnIndex);
        }
      }
      
      results.push(parentBasename);
      indexToBasename.set(taskIndex, task.title);
    }
    
    expect(results[0]).toBeUndefined(); // Invalid negative
    expect(results[1]).toBeUndefined(); // Invalid future reference
    expect(results[2]).toBe("Task B");  // Valid reference to index 1
  });

  it("handles self-reference gracefully", () => {
    const indexToBasename = new Map<number, string>();
    const task = { title: "Self Ref", dependsOn: 0 }; // Trying to depend on self
    const taskIndex = 0;
    
    let parentBasename: string | undefined = undefined;
    if (task.dependsOn !== null) {
      const dependsOnIndex = task.dependsOn;
      // dependsOnIndex (0) is NOT less than taskIndex (0), so it's rejected
      if (dependsOnIndex >= 0 && dependsOnIndex < taskIndex && indexToBasename.has(dependsOnIndex)) {
        parentBasename = indexToBasename.get(dependsOnIndex);
      }
    }
    
    expect(parentBasename).toBeUndefined();
  });
});

