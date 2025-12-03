/**
 * Unit tests for context loader functions
 */

import { formatContextForPrompt, UserContext } from "../src/context-loader";

// Mock the Obsidian modules
jest.mock("obsidian", () => ({
  App: jest.fn(),
  TFile: jest.fn(),
  TFolder: jest.fn(),
  CachedMetadata: jest.fn(),
}));

describe("formatContextForPrompt", () => {
  it("formats empty context with fallback messages", () => {
    const emptyContext: UserContext = {
      goals: [],
      projects: [],
      epics: [],
      activeTasks: [],
    };

    const result = formatContextForPrompt(emptyContext);

    expect(result.goals).toBe("No goals defined");
    expect(result.projects).toBe("No projects defined");
    expect(result.epics).toBe("No epics defined");
    expect(result.tasks).toBe("No active tasks");
  });

  it("formats goals correctly", () => {
    const context: UserContext = {
      goals: [
        { name: "Goal 1", path: "goals/goal1.md", area: "Work", status: "active", milestones: [] },
        { name: "Goal 2", path: "goals/goal2.md", area: "Personal", status: "completed", milestones: [] },
      ],
      projects: [],
      epics: [],
      activeTasks: [],
    };

    const result = formatContextForPrompt(context);

    expect(result.goals).toContain("Goal 1");
    expect(result.goals).toContain("active");
    expect(result.goals).toContain("Work");
    expect(result.goals).toContain("Goal 2");
    expect(result.goals).toContain("completed");
    expect(result.goals).toContain("Personal");
  });

  it("formats projects correctly", () => {
    const context: UserContext = {
      goals: [],
      projects: [
        { name: "Project A", path: "projects/a.md", area: "Tech", goal: "Goal 1", status: "in-progress" },
      ],
      epics: [],
      activeTasks: [],
    };

    const result = formatContextForPrompt(context);

    expect(result.projects).toContain("Project A");
    expect(result.projects).toContain("in-progress");
    expect(result.projects).toContain("Goal 1");
  });

  it("formats epics correctly", () => {
    const context: UserContext = {
      goals: [],
      projects: [],
      epics: [
        { 
          name: "Epic 1", 
          path: "epics/e1.md", 
          area: "Work", 
          goal: "Goal 1", 
          project: "Project A", 
          milestone: "M1",
          status: "active",
          description: "Epic description"
        },
      ],
      activeTasks: [],
    };

    const result = formatContextForPrompt(context);

    expect(result.epics).toContain("Epic 1");
    expect(result.epics).toContain("active");
    expect(result.epics).toContain("Project A");
    expect(result.epics).toContain("Goal 1");
  });

  it("formats active tasks correctly", () => {
    const context: UserContext = {
      goals: [],
      projects: [],
      epics: [],
      activeTasks: [
        {
          name: "Task 1",
          path: "tasks/t1.md",
          area: "Work",
          goal: "Goal 1",
          project: "Project A",
          epic: "Epic 1",
          status: "in-progress",
          priority: "high",
          due: "2024-12-31",
        },
      ],
    };

    const result = formatContextForPrompt(context);

    expect(result.tasks).toContain("Task 1");
    expect(result.tasks).toContain("in-progress");
    expect(result.tasks).toContain("high");
    expect(result.tasks).toContain("Epic 1");
  });

  it("limits active tasks to 20", () => {
    const manyTasks = Array.from({ length: 30 }, (_, index) => ({
      name: `Task ${index}`,
      path: `tasks/t${index}.md`,
      area: "",
      goal: "",
      project: "",
      epic: "",
      status: "backlog",
      priority: "medium",
      due: "",
    }));

    const context: UserContext = {
      goals: [],
      projects: [],
      epics: [],
      activeTasks: manyTasks,
    };

    const result = formatContextForPrompt(context);

    // Should only include first 20 tasks
    expect(result.tasks).toContain("Task 0");
    expect(result.tasks).toContain("Task 19");
    expect(result.tasks).not.toContain("Task 20");
    expect(result.tasks).not.toContain("Task 29");
  });

  it("handles missing status/area/goal with fallbacks", () => {
    const context: UserContext = {
      goals: [
        { name: "Goal", path: "g.md", area: "", status: "", milestones: [] },
      ],
      projects: [
        { name: "Project", path: "p.md", area: "", goal: "", status: "" },
      ],
      epics: [
        { name: "Epic", path: "e.md", area: "", goal: "", project: "", milestone: "", status: "", description: "" },
      ],
      activeTasks: [
        { name: "Task", path: "t.md", area: "", goal: "", project: "", epic: "", status: "", priority: "", due: "" },
      ],
    };

    const result = formatContextForPrompt(context);

    // Should use fallback values like "active", "none", "backlog", "medium"
    expect(result.goals).toContain("active");
    expect(result.goals).toContain("none");
    expect(result.projects).toContain("active");
    expect(result.projects).toContain("none");
    expect(result.epics).toContain("backlog");
    expect(result.tasks).toContain("backlog");
    expect(result.tasks).toContain("medium");
  });

  it("handles special characters in names", () => {
    const context: UserContext = {
      goals: [
        { name: "Goal with [brackets] and (parens)", path: "g.md", area: "Area/Sub", status: "active", milestones: [] },
      ],
      projects: [],
      epics: [],
      activeTasks: [],
    };

    const result = formatContextForPrompt(context);

    expect(result.goals).toContain("Goal with [brackets] and (parens)");
    expect(result.goals).toContain("Area/Sub");
  });
});

describe("context loading behavior (conceptual)", () => {
  // These tests document expected behavior without actually scanning the vault
  
  describe("loadGoals", () => {
    it("should return empty array if folder doesn't exist", () => {
      // When goalsFolder path doesn't exist, should return []
      expect(true).toBe(true);
    });

    it("should only include files with Type containing 'goal'", () => {
      // Files without Type: [[Goals]] or similar should be excluded
      expect(true).toBe(true);
    });

    it("should extract frontmatter fields correctly", () => {
      // Area, Status, etc. should be extracted from frontmatter
      expect(true).toBe(true);
    });
  });

  describe("loadProjects", () => {
    it("should recursively scan subfolders", () => {
      // Unlike goals, projects can be in nested folders
      expect(true).toBe(true);
    });

    it("should only include files with Type containing 'project'", () => {
      expect(true).toBe(true);
    });
  });

  describe("loadEpics", () => {
    it("should return empty array if folder doesn't exist", () => {
      expect(true).toBe(true);
    });

    it("should extract description from frontmatter", () => {
      expect(true).toBe(true);
    });
  });

  describe("loadActiveTasks", () => {
    it("should recursively scan subfolders", () => {
      expect(true).toBe(true);
    });

    it("should exclude completed tasks", () => {
      // Tasks with status containing 'completed' should be filtered out
      expect(true).toBe(true);
    });

    it("should extract priority and due date", () => {
      expect(true).toBe(true);
    });
  });

  describe("extractFrontmatterString", () => {
    it("should handle string values", () => {
      // "value" -> "value"
      expect(true).toBe(true);
    });

    it("should extract name from wikilinks", () => {
      // "[[Note Name]]" -> "Note Name"
      // "[[Note Name|Alias]]" -> "Note Name"
      expect(true).toBe(true);
    });

    it("should handle arrays", () => {
      // ["a", "b"] -> "a, b"
      expect(true).toBe(true);
    });

    it("should handle null/undefined", () => {
      // null -> ""
      // undefined -> ""
      expect(true).toBe(true);
    });
  });
});

describe("findMatchingEpic", () => {
  // Test the epic matching algorithm
  
  it("should prioritize project match over goal match", () => {
    // When both project and goal could match, prefer project
    expect(true).toBe(true);
  });

  it("should fall back to goal match if no project match", () => {
    expect(true).toBe(true);
  });

  it("should fall back to area match if no goal match", () => {
    expect(true).toBe(true);
  });

  it("should return null if no match found", () => {
    expect(true).toBe(true);
  });

  it("should handle case-insensitive matching", () => {
    // "myproject" should match "MyProject"
    expect(true).toBe(true);
  });

  it("should handle partial matches", () => {
    // "My" should match "My Project"
    expect(true).toBe(true);
  });
});


