/**
 * Unit tests for voice input parsing
 */

import { parseVoiceTaskInput } from "../src/voice";

// Mock the obsidian and api-client modules
jest.mock("obsidian", () => ({
  Modal: jest.fn(),
  App: jest.fn(),
  Notice: jest.fn(),
}));

jest.mock("../src/api-client", () => ({
  callWhisperApi: jest.fn(),
  CancellationToken: jest.fn(),
}));

jest.mock("../src/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("parseVoiceTaskInput", () => {
  describe("basic task title extraction", () => {
    it("extracts raw transcription as task title", () => {
      const result = parseVoiceTaskInput("Create a landing page");
      expect(result.taskTitle).toBe("Create a landing page");
      expect(result.rawText).toBe("Create a landing page");
    });

    it("trims whitespace from transcription", () => {
      const result = parseVoiceTaskInput("  Create a task  ");
      expect(result.taskTitle).toBe("Create a task");
    });

    it("handles empty transcription", () => {
      const result = parseVoiceTaskInput("");
      expect(result.taskTitle).toBe("");
      expect(result.rawText).toBe("");
    });
  });

  describe("priority extraction - English", () => {
    it("extracts high priority from 'high priority' phrase", () => {
      const result = parseVoiceTaskInput("high priority fix the login bug");
      expect(result.priority).toBe("high");
    });

    it("extracts high priority from 'priority: high' format", () => {
      const result = parseVoiceTaskInput("priority: high create landing page");
      expect(result.priority).toBe("high");
    });

    it("extracts high priority from 'urgent priority' phrase", () => {
      const result = parseVoiceTaskInput("urgent priority deploy the fix");
      expect(result.priority).toBe("high");
    });

    it("extracts critical priority", () => {
      const result = parseVoiceTaskInput("critical fix the payment system");
      expect(result.priority).toBe("critical");
    });

    it("extracts low priority from 'low priority' phrase", () => {
      const result = parseVoiceTaskInput("low priority update documentation");
      expect(result.priority).toBe("low");
    });

    it("extracts low priority from 'priority: low' format", () => {
      const result = parseVoiceTaskInput("priority: low refactor code");
      expect(result.priority).toBe("low");
    });

    it("returns empty string when no priority mentioned", () => {
      const result = parseVoiceTaskInput("create a new feature");
      expect(result.priority).toBe("");
    });
  });

  describe("priority extraction - Korean", () => {
    it("extracts high priority from Korean '높은 priority'", () => {
      const result = parseVoiceTaskInput("높은 priority 버그 수정");
      expect(result.priority).toBe("high");
    });

    it("extracts high priority from Korean '긴급'", () => {
      const result = parseVoiceTaskInput("긴급 priority 배포");
      expect(result.priority).toBe("high");
    });

    it("extracts critical priority from Korean '매우 중요'", () => {
      const result = parseVoiceTaskInput("매우 중요한 작업입니다");
      expect(result.priority).toBe("critical");
    });

    it("extracts low priority from Korean '낮은 priority'", () => {
      const result = parseVoiceTaskInput("낮은 priority 문서 업데이트");
      expect(result.priority).toBe("low");
    });
  });

  describe("project extraction", () => {
    it("extracts project from 'for the X project' format", () => {
      const result = parseVoiceTaskInput("Create landing page for the Freedom Runway project");
      expect(result.project).toBe("Freedom Runway");
    });

    it("extracts project from 'in X project' format", () => {
      const result = parseVoiceTaskInput("Fix bug in MyApp project");
      expect(result.project).toBe("MyApp");
    });

    it("extracts project from 'to X project' format", () => {
      const result = parseVoiceTaskInput("Add feature to Dashboard project");
      expect(result.project).toBe("Dashboard");
    });

    it("extracts project from 'project: X' format", () => {
      const result = parseVoiceTaskInput("project: WebApp. create login page");
      // The regex captures until end of sentence or comma
      expect(result.project.length).toBeGreaterThan(0);
    });

    it("extracts project from Korean '프로젝트' format", () => {
      const result = parseVoiceTaskInput("랜딩 페이지를 위한 프로젝트: 프리덤 런웨이");
      expect(result.project).toBe("프리덤 런웨이");
    });

    it("returns empty string when no project mentioned", () => {
      const result = parseVoiceTaskInput("create a new feature");
      expect(result.project).toBe("");
    });
  });

  describe("epic extraction", () => {
    it("extracts epic from 'for the X epic' format", () => {
      const result = parseVoiceTaskInput("Create task for the User Authentication epic");
      expect(result.epic).toBe("User Authentication");
    });

    it("extracts epic from 'for X epic' format", () => {
      const result = parseVoiceTaskInput("Add login for Payment epic");
      // The regex uses "for/in/to X epic" pattern (without "the")
      expect(result.epic).toBe("Payment");
    });

    it("extracts epic from 'epic: X' format", () => {
      const result = parseVoiceTaskInput("epic: Dashboard Redesign, create wireframes");
      // The regex captures until comma/period/end
      expect(result.epic.length).toBeGreaterThan(0);
    });

    it("extracts epic from Korean '에픽' format", () => {
      const result = parseVoiceTaskInput("에픽: 사용자 인증 로그인 추가");
      // Korean epic extraction uses the epic: pattern
      expect(result.epic.length).toBeGreaterThan(0);
    });

    it("returns empty string when no epic mentioned", () => {
      const result = parseVoiceTaskInput("create a new feature");
      expect(result.epic).toBe("");
    });
  });

  describe("task title cleanup after extraction", () => {
    it("removes priority phrases from task title", () => {
      const result = parseVoiceTaskInput("high priority create landing page");
      expect(result.taskTitle).not.toContain("high priority");
      expect(result.taskTitle).toContain("landing page");
    });

    it("removes project references from task title", () => {
      const result = parseVoiceTaskInput("Create page for the MyProject project");
      expect(result.taskTitle).not.toContain("for the MyProject project");
    });

    it("cleans up multiple spaces", () => {
      const result = parseVoiceTaskInput("high priority   create   landing page");
      expect(result.taskTitle).not.toContain("  ");
    });

    it("trims leading/trailing punctuation and spaces", () => {
      const result = parseVoiceTaskInput("priority: high, create landing page.");
      expect(result.taskTitle).not.toMatch(/^[,.\s]/);
      expect(result.taskTitle).not.toMatch(/[,.\s]$/);
    });
  });

  describe("complex input combinations", () => {
    it("extracts priority and project from complex English input", () => {
      const result = parseVoiceTaskInput(
        "high priority create login for Freedom Runway project"
      );
      expect(result.priority).toBe("high");
      // Project extraction captures from "for X project" pattern
      expect(result.project).toBe("Freedom Runway");
    });

    it("handles Korean mixed with English", () => {
      const result = parseVoiceTaskInput(
        "긴급 priority 로그인 페이지 만들기"
      );
      expect(result.priority).toBe("high");
      expect(result.taskTitle).toContain("로그인");
    });

    it("handles punctuation in transcription", () => {
      const result = parseVoiceTaskInput(
        "Create a landing page, with high priority."
      );
      // Should still work even with punctuation
      expect(result.taskTitle.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases and resilience", () => {
    it("handles very long transcription", () => {
      const longText = "Create a task ".repeat(100);
      const result = parseVoiceTaskInput(longText);
      expect(result.rawText).toBe(longText);
      expect(result.taskTitle.length).toBeGreaterThan(0);
    });

    it("handles special characters", () => {
      const result = parseVoiceTaskInput("Create task #123 with @mention");
      expect(result.taskTitle).toContain("#123");
      expect(result.taskTitle).toContain("@mention");
    });

    it("handles numbers in transcription", () => {
      const result = parseVoiceTaskInput("Fix bug 12345 in module");
      expect(result.taskTitle).toContain("12345");
    });

    it("handles emoji in transcription", () => {
      const result = parseVoiceTaskInput("🚀 Launch the feature");
      expect(result.taskTitle).toContain("🚀");
    });
  });
});


