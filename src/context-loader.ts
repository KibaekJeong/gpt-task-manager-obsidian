import { App, TFile, TFolder, CachedMetadata } from "obsidian";

/**
 * Represents a goal from the vault
 */
export interface GoalContext {
  name: string;
  path: string;
  area: string;
  status: string;
  milestones: string[];
}

/**
 * Represents a project from the vault
 */
export interface ProjectContext {
  name: string;
  path: string;
  area: string;
  goal: string;
  status: string;
}

/**
 * Represents an epic from the vault
 */
export interface EpicContext {
  name: string;
  path: string;
  area: string;
  goal: string;
  project: string;
  milestone: string;
  status: string;
  description: string;
}

/**
 * Represents a task from the vault
 */
export interface TaskContext {
  name: string;
  path: string;
  area: string;
  goal: string;
  project: string;
  epic: string;
  status: string;
  priority: string;
  due: string;
}

/**
 * Complete user context for GPT
 */
export interface UserContext {
  goals: GoalContext[];
  projects: ProjectContext[];
  epics: EpicContext[];
  activeTasks: TaskContext[];
}

/**
 * Load all goals from the vault
 */
export function loadGoals(app: App, goalsFolder: string): GoalContext[] {
  const goals: GoalContext[] = [];
  const folder = app.vault.getAbstractFileByPath(goalsFolder);

  if (!folder || !(folder instanceof TFolder)) {
    return goals;
  }

  for (const child of folder.children) {
    if (child instanceof TFile && child.extension === "md") {
      const cache = app.metadataCache.getFileCache(child);
      if (!cache?.frontmatter) continue;

      const frontmatter = cache.frontmatter;
      const type = extractFrontmatterString(frontmatter.Type);

      if (type.toLowerCase().includes("goal")) {
        goals.push({
          name: child.basename,
          path: child.path,
          area: extractFrontmatterString(frontmatter.Area),
          status: extractFrontmatterString(frontmatter.Status),
          milestones: [],
        });
      }
    }
  }

  return goals;
}

/**
 * Load all projects from the vault
 */
export function loadProjects(app: App, projectsFolder: string): ProjectContext[] {
  const projects: ProjectContext[] = [];
  const folder = app.vault.getAbstractFileByPath(projectsFolder);

  if (!folder || !(folder instanceof TFolder)) {
    return projects;
  }

  const processFolder = (currentFolder: TFolder): void => {
    for (const child of currentFolder.children) {
      if (child instanceof TFile && child.extension === "md") {
        const cache = app.metadataCache.getFileCache(child);
        if (!cache?.frontmatter) continue;

        const frontmatter = cache.frontmatter;
        const type = extractFrontmatterString(frontmatter.Type);

        if (type.toLowerCase().includes("project")) {
          projects.push({
            name: child.basename,
            path: child.path,
            area: extractFrontmatterString(frontmatter.Area),
            goal: extractFrontmatterString(frontmatter.Goal),
            status: extractFrontmatterString(frontmatter.Status),
          });
        }
      } else if (child instanceof TFolder) {
        processFolder(child);
      }
    }
  };

  processFolder(folder);
  return projects;
}

/**
 * Load all epics from the vault
 */
export function loadEpics(app: App, epicsFolder: string): EpicContext[] {
  const epics: EpicContext[] = [];
  const folder = app.vault.getAbstractFileByPath(epicsFolder);

  if (!folder || !(folder instanceof TFolder)) {
    return epics;
  }

  for (const child of folder.children) {
    if (child instanceof TFile && child.extension === "md") {
      const cache = app.metadataCache.getFileCache(child);
      if (!cache?.frontmatter) continue;

      const frontmatter = cache.frontmatter;
      const type = extractFrontmatterString(frontmatter.Type);

      if (type.toLowerCase().includes("epic")) {
        epics.push({
          name: child.basename,
          path: child.path,
          area: extractFrontmatterString(frontmatter.Area),
          goal: extractFrontmatterString(frontmatter.Goal),
          project: extractFrontmatterString(frontmatter.Project),
          milestone: extractFrontmatterString(frontmatter.Milestone),
          status: extractFrontmatterString(frontmatter.Status),
          description: extractFrontmatterString(frontmatter.Description),
        });
      }
    }
  }

  return epics;
}

/**
 * Load active tasks from the vault
 */
export function loadActiveTasks(app: App, tasksFolder: string): TaskContext[] {
  const tasks: TaskContext[] = [];
  const folder = app.vault.getAbstractFileByPath(tasksFolder);

  if (!folder || !(folder instanceof TFolder)) {
    return tasks;
  }

  const processFolder = (currentFolder: TFolder): void => {
    for (const child of currentFolder.children) {
      if (child instanceof TFile && child.extension === "md") {
        const cache = app.metadataCache.getFileCache(child);
        if (!cache?.frontmatter) continue;

        const frontmatter = cache.frontmatter;
        const type = extractFrontmatterString(frontmatter.Type);
        const status = extractFrontmatterString(frontmatter.Status);

        // Only include non-completed tasks
        if (type.toLowerCase().includes("task") && !status.toLowerCase().includes("completed")) {
          tasks.push({
            name: child.basename,
            path: child.path,
            area: extractFrontmatterString(frontmatter.Area),
            goal: extractFrontmatterString(frontmatter.Goal),
            project: extractFrontmatterString(frontmatter.Project),
            epic: extractFrontmatterString(frontmatter.Epic),
            status: status,
            priority: extractFrontmatterString(frontmatter.Priority),
            due: extractFrontmatterString(frontmatter.Due),
          });
        }
      } else if (child instanceof TFolder) {
        processFolder(child);
      }
    }
  };

  processFolder(folder);
  return tasks;
}

/**
 * Load complete user context for GPT
 */
export function loadUserContext(
  app: App,
  goalsFolder: string,
  projectsFolder: string,
  epicsFolder: string,
  tasksFolder: string
): UserContext {
  return {
    goals: loadGoals(app, goalsFolder),
    projects: loadProjects(app, projectsFolder),
    epics: loadEpics(app, epicsFolder),
    activeTasks: loadActiveTasks(app, tasksFolder),
  };
}

/**
 * Format user context for GPT prompt
 */
export function formatContextForPrompt(context: UserContext): {
  goals: string;
  projects: string;
  epics: string;
  tasks: string;
} {
  const goals = context.goals
    .map(goal => `- ${goal.name} (${goal.status || "active"}) - Area: ${goal.area || "none"}`)
    .join("\n") || "No goals defined";

  const projects = context.projects
    .map(project => `- ${project.name} (${project.status || "active"}) - Goal: ${project.goal || "none"}`)
    .join("\n") || "No projects defined";

  const epics = context.epics
    .map(epic => `- ${epic.name} (${epic.status || "backlog"}) - Project: ${epic.project || "none"}, Goal: ${epic.goal || "none"}`)
    .join("\n") || "No epics defined";

  const tasks = context.activeTasks
    .slice(0, 20) // Limit to avoid token overflow
    .map(task => `- ${task.name} (${task.status || "backlog"}, ${task.priority || "medium"}) - Epic: ${task.epic || "none"}`)
    .join("\n") || "No active tasks";

  return { goals, projects, epics, tasks };
}

/**
 * Extract string value from frontmatter (handles arrays, links, etc.)
 */
function extractFrontmatterString(value: unknown): string {
  if (!value) return "";

  if (typeof value === "string") {
    // Remove wikilink brackets
    return value.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1").trim();
  }

  if (Array.isArray(value)) {
    return value
      .map(item => extractFrontmatterString(item))
      .filter(Boolean)
      .join(", ");
  }

  return String(value);
}

/**
 * Find best matching epic for a given task context
 */
export function findMatchingEpic(
  taskContext: { project?: string; goal?: string; area?: string },
  epics: EpicContext[]
): EpicContext | null {
  // First, try to match by project
  if (taskContext.project) {
    const projectMatch = epics.find(epic =>
      epic.project.toLowerCase().includes(taskContext.project!.toLowerCase()) ||
      taskContext.project!.toLowerCase().includes(epic.project.toLowerCase())
    );
    if (projectMatch) return projectMatch;
  }

  // Then, try to match by goal
  if (taskContext.goal) {
    const goalMatch = epics.find(epic =>
      epic.goal.toLowerCase().includes(taskContext.goal!.toLowerCase()) ||
      taskContext.goal!.toLowerCase().includes(epic.goal.toLowerCase())
    );
    if (goalMatch) return goalMatch;
  }

  // Finally, try to match by area
  if (taskContext.area) {
    const areaMatch = epics.find(epic =>
      epic.area.toLowerCase().includes(taskContext.area!.toLowerCase()) ||
      taskContext.area!.toLowerCase().includes(epic.area.toLowerCase())
    );
    if (areaMatch) return areaMatch;
  }

  return null;
}

/**
 * Get epic metadata from the vault
 */
export async function getEpicMetadata(app: App, epicName: string, epicsFolder: string): Promise<{
  area: string;
  goal: string;
  project: string;
  milestone: string;
} | null> {
  const epicPath = `${epicsFolder}/${epicName}.md`;
  const epicFile = app.vault.getAbstractFileByPath(epicPath);

  if (!epicFile || !(epicFile instanceof TFile)) {
    return null;
  }

  const cache = app.metadataCache.getFileCache(epicFile);
  if (!cache?.frontmatter) {
    return null;
  }

  const frontmatter = cache.frontmatter;

  return {
    area: extractFrontmatterString(frontmatter.Area),
    goal: extractFrontmatterString(frontmatter.Goal),
    project: extractFrontmatterString(frontmatter.Project),
    milestone: extractFrontmatterString(frontmatter.Milestone),
  };
}

