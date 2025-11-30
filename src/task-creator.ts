import { App, TFile, TFolder, normalizePath, Notice } from "obsidian";
import { GptTaskManagerSettings } from "./settings";
import { TaskSuggestion, TaskBreakdown } from "./gpt-service";

/**
 * Parameters for creating a new task
 */
export interface CreateTaskParams {
  title: string;
  objective?: string;
  importance?: string;
  area?: string;
  goal?: string;
  project?: string;
  epic?: string;
  status?: string;
  priority?: string;
  due?: string;
  parent?: string;
  tags?: string[];
}

/**
 * Ensure a folder exists, creating it if necessary
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath);
  const existingFolder = app.vault.getAbstractFileByPath(normalizedPath);

  if (existingFolder && existingFolder instanceof TFolder) {
    return;
  }

  try {
    await app.vault.createFolder(normalizedPath);
  } catch (error) {
    // Folder might already exist or path might have been created by another call
    console.log(`[GPT Task Manager] Folder creation note: ${folderPath}`, error);
  }
}

/**
 * Sanitize filename for use in vault
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100); // Limit length
}

/**
 * Generate task note content from template and parameters
 */
export function generateTaskContent(
  params: CreateTaskParams,
  settings: GptTaskManagerSettings
): string {
  const timestamp = new Date();
  const createdAt = formatDateTime(timestamp);
  const updatedAt = formatDateTime(timestamp);

  // Format values for frontmatter
  const formatLink = (value: string | undefined): string => {
    if (!value) return "Empty";
    // Check if already a link
    if (value.startsWith("[[") && value.endsWith("]]")) {
      return `"${value}"`;
    }
    return `"[[${value}]]"`;
  };

  const formatString = (value: string | undefined): string => {
    if (!value) return "";
    return value;
  };

  const formatTags = (tags: string[] | undefined): string => {
    if (!tags || tags.length === 0) {
      return "  - tasks";
    }
    return tags.map(tag => `  - ${tag.startsWith("#") ? tag.substring(1) : tag}`).join("\n");
  };

  // Build frontmatter
  const frontmatter = `---
Type: "[[Tasks]]"
Area: ${formatLink(params.area)}
Goal: ${formatLink(params.goal)}
Project: ${formatLink(params.project)}
Epic: ${formatLink(params.epic)}
Status: ${params.status || settings.defaultStatus}
Priority: ${params.priority || settings.defaultPriority}
Due: ${params.due || ""}
Created: "${createdAt}"
Updated: "${updatedAt}"
tags:
${formatTags(params.tags)}
Cover: 
Description: "${formatString(params.objective)}"
Topics: 
Parent: ${params.parent ? formatLink(params.parent) : "Empty"}
---`;

  // Build body content
  const body = `
## 🔄 Sync
- [ ] ${params.title}

## 🎯 Objective
> What needs to be accomplished:
- ${params.objective || ""}

> Why it matters:
- ${params.importance || ""}


## ⚙️ Progress Log

> **Updates / checkpoints:**
> Date - 


## 🧠 Notes / Insights
>


## 💡 Reflection
> What was learned or decided:
- 

> What to improve next time:
- 
  
  

---
### 🔗 Related Notes
- 
`;

  return frontmatter + body;
}

/**
 * Generate task content from GPT suggestion
 */
export function generateTaskFromSuggestion(
  suggestion: TaskSuggestion,
  epicMetadata: {
    area?: string;
    goal?: string;
    project?: string;
  } | null,
  settings: GptTaskManagerSettings
): string {
  const params: CreateTaskParams = {
    title: suggestion.title,
    objective: suggestion.objective,
    importance: suggestion.importance,
    area: epicMetadata?.area || "",
    goal: epicMetadata?.goal || "",
    project: suggestion.suggestedProject || epicMetadata?.project || "",
    epic: suggestion.suggestedEpic || "",
    priority: suggestion.priority,
    tags: ["tasks"],
  };

  return generateTaskContent(params, settings);
}

/**
 * Create a task file in the vault
 */
export async function createTaskFile(
  app: App,
  content: string,
  title: string,
  epicName: string | null,
  settings: GptTaskManagerSettings
): Promise<TFile> {
  const sanitizedTitle = sanitizeFilename(title);
  let taskPath: string;

  if (epicName) {
    // Create in epic's active folder
    const epicFolder = `${settings.tasksFolder}/active epic folder/${sanitizeFilename(epicName)}`;
    await ensureFolderExists(app, epicFolder);
    taskPath = `${epicFolder}/${sanitizedTitle}.md`;
  } else {
    // Create in inbox or main tasks folder
    const inboxPath = `${settings.tasksFolder}/inbox.md`;
    const hasInbox = app.vault.getAbstractFileByPath(inboxPath);

    if (hasInbox) {
      // Use tasks folder directly
      taskPath = `${settings.tasksFolder}/${sanitizedTitle}.md`;
    } else {
      taskPath = `${settings.tasksFolder}/${sanitizedTitle}.md`;
    }
  }

  // Check if file already exists
  const normalizedPath = normalizePath(taskPath);
  const existingFile = app.vault.getAbstractFileByPath(normalizedPath);

  if (existingFile instanceof TFile) {
    // Append number to make unique
    let counter = 1;
    let newPath = taskPath;
    while (app.vault.getAbstractFileByPath(newPath)) {
      newPath = taskPath.replace(".md", ` (${counter}).md`);
      counter++;
    }
    taskPath = newPath;
  }

  // Create the file
  const file = await app.vault.create(normalizePath(taskPath), content);
  return file;
}

/**
 * Create multiple tasks from a breakdown
 */
export async function createTasksFromBreakdown(
  app: App,
  breakdown: TaskBreakdown,
  epicName: string,
  epicMetadata: {
    area?: string;
    goal?: string;
    project?: string;
  } | null,
  settings: GptTaskManagerSettings
): Promise<TFile[]> {
  const createdFiles: TFile[] = [];
  let previousTask: string | null = null;

  for (const task of breakdown.tasks) {
    const params: CreateTaskParams = {
      title: task.title,
      objective: task.objective,
      area: epicMetadata?.area || "",
      goal: epicMetadata?.goal || "",
      project: epicMetadata?.project || "",
      epic: epicName,
      priority: task.priority,
      parent: task.dependsOn !== null && previousTask ? previousTask : undefined,
      tags: ["tasks"],
    };

    const content = generateTaskContent(params, settings);

    try {
      const file = await createTaskFile(app, content, task.title, epicName, settings);
      createdFiles.push(file);
      previousTask = file.basename;
    } catch (error) {
      console.error(`[GPT Task Manager] Failed to create task: ${task.title}`, error);
      new Notice(`Failed to create task: ${task.title}`);
    }
  }

  return createdFiles;
}

/**
 * Format date time for frontmatter
 */
function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Get the next available task path (handling duplicates)
 */
export function getUniqueTaskPath(
  app: App,
  basePath: string,
  title: string
): string {
  const sanitizedTitle = sanitizeFilename(title);
  let taskPath = `${basePath}/${sanitizedTitle}.md`;
  let counter = 1;

  while (app.vault.getAbstractFileByPath(normalizePath(taskPath))) {
    taskPath = `${basePath}/${sanitizedTitle} (${counter}).md`;
    counter++;
  }

  return normalizePath(taskPath);
}

