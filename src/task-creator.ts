import { App, TFile, TFolder, normalizePath, Notice, Modal } from "obsidian";
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
 * Summary item for confirmation dialog
 */
export interface TaskCreationSummary {
  title: string;
  targetFolder: string;
  epic: string | null;
  priority: string;
  dependsOnTask: string | null;
}

/**
 * Result of confirmation dialog
 */
export interface ConfirmationResult {
  confirmed: boolean;
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
 * Falls back to raw input or default if sanitized result is empty
 */
export function sanitizeFilename(filename: string, fallbackDefault: string = "Untitled Task"): string {
  const sanitized = filename
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100); // Limit length
  
  // If sanitized is empty, try using the raw input trimmed, or fallback to default
  if (!sanitized || sanitized.length === 0) {
    const rawTrimmed = filename.trim().substring(0, 100);
    if (rawTrimmed && rawTrimmed.length > 0) {
      // Remove only the most dangerous characters
      return rawTrimmed.replace(/[\\/:]/g, "-");
    }
    return fallbackDefault;
  }
  
  return sanitized;
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
 * Ensures base tasks folder and epic folders exist before creating
 */
export async function createTaskFile(
  app: App,
  content: string,
  title: string,
  epicName: string | null,
  settings: GptTaskManagerSettings
): Promise<TFile> {
  const sanitizedTitle = sanitizeFilename(title, `Task-${Date.now()}`);
  let taskPath: string;

  // Always ensure the base tasks folder exists
  await ensureFolderExists(app, settings.tasksFolder);

  if (epicName) {
    // Create in epic's active folder
    const sanitizedEpicName = sanitizeFilename(epicName, "Untitled Epic");
    const epicFolder = `${settings.tasksFolder}/active epic folder/${sanitizedEpicName}`;
    // Ensure parent "active epic folder" exists first
    await ensureFolderExists(app, `${settings.tasksFolder}/active epic folder`);
    // Then ensure the specific epic folder exists
    await ensureFolderExists(app, epicFolder);
    taskPath = `${epicFolder}/${sanitizedTitle}.md`;
  } else {
    // Create in main tasks folder
    taskPath = `${settings.tasksFolder}/${sanitizedTitle}.md`;
  }

  // Check if file already exists and generate unique path
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
 * Create multiple tasks from a breakdown with proper dependency mapping
 * Maps GPT task indices to created file basenames for accurate parent links
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
  // Map from task index (0-based) to created file basename
  const indexToBasename: Map<number, string> = new Map();

  // Ensure base folders exist before creating any tasks
  await ensureFolderExists(app, settings.tasksFolder);
  if (epicName) {
    const sanitizedEpicName = sanitizeFilename(epicName, "Untitled Epic");
    await ensureFolderExists(app, `${settings.tasksFolder}/active epic folder`);
    await ensureFolderExists(app, `${settings.tasksFolder}/active epic folder/${sanitizedEpicName}`);
  }

  for (let taskIndex = 0; taskIndex < breakdown.tasks.length; taskIndex++) {
    const task = breakdown.tasks[taskIndex];
    
    // Resolve dependency: map dependsOn index to actual created file basename
    let parentBasename: string | undefined = undefined;
    if (task.dependsOn !== null && task.dependsOn !== undefined) {
      const dependsOnIndex = task.dependsOn;
      // Check if the referenced index is valid and has been created
      if (dependsOnIndex >= 0 && dependsOnIndex < taskIndex && indexToBasename.has(dependsOnIndex)) {
        parentBasename = indexToBasename.get(dependsOnIndex);
      }
      // If dependsOn references an invalid or future index, leave parent unset
    }

    const params: CreateTaskParams = {
      title: task.title,
      objective: task.objective,
      area: epicMetadata?.area || "",
      goal: epicMetadata?.goal || "",
      project: epicMetadata?.project || "",
      epic: epicName,
      priority: task.priority,
      parent: parentBasename,
      tags: ["tasks"],
    };

    const content = generateTaskContent(params, settings);

    try {
      const file = await createTaskFile(app, content, task.title, epicName, settings);
      createdFiles.push(file);
      // Store mapping from index to basename for dependency resolution
      indexToBasename.set(taskIndex, file.basename);
    } catch (error) {
      console.error(`[GPT Task Manager] Failed to create task: ${task.title}`, error);
      new Notice(`Failed to create task: ${task.title}`);
    }
  }

  return createdFiles;
}

/**
 * Build task creation summaries for confirmation dialog
 */
export function buildBreakdownSummaries(
  breakdown: TaskBreakdown,
  epicName: string,
  settings: GptTaskManagerSettings
): TaskCreationSummary[] {
  const summaries: TaskCreationSummary[] = [];
  const sanitizedEpicName = sanitizeFilename(epicName, "Untitled Epic");
  const targetFolder = `${settings.tasksFolder}/active epic folder/${sanitizedEpicName}`;
  
  // Build a temporary map to resolve dependency names for preview
  const indexToTitle: Map<number, string> = new Map();
  breakdown.tasks.forEach((task, index) => {
    indexToTitle.set(index, task.title);
  });

  for (let taskIndex = 0; taskIndex < breakdown.tasks.length; taskIndex++) {
    const task = breakdown.tasks[taskIndex];
    
    // Resolve dependency title for display
    let dependsOnTask: string | null = null;
    if (task.dependsOn !== null && task.dependsOn !== undefined) {
      const dependsOnIndex = task.dependsOn;
      if (dependsOnIndex >= 0 && dependsOnIndex < breakdown.tasks.length && indexToTitle.has(dependsOnIndex)) {
        dependsOnTask = indexToTitle.get(dependsOnIndex) || null;
      }
    }

    summaries.push({
      title: task.title,
      targetFolder: targetFolder,
      epic: epicName,
      priority: task.priority || settings.defaultPriority,
      dependsOnTask: dependsOnTask,
    });
  }

  return summaries;
}

/**
 * Build task creation summary for single task from suggestion
 */
export function buildSuggestionSummary(
  suggestion: TaskSuggestion,
  epicName: string | null,
  settings: GptTaskManagerSettings
): TaskCreationSummary {
  let targetFolder: string;
  
  if (epicName) {
    const sanitizedEpicName = sanitizeFilename(epicName, "Untitled Epic");
    targetFolder = `${settings.tasksFolder}/active epic folder/${sanitizedEpicName}`;
  } else {
    targetFolder = settings.tasksFolder;
  }

  return {
    title: suggestion.title,
    targetFolder: targetFolder,
    epic: epicName,
    priority: suggestion.priority || settings.defaultPriority,
    dependsOnTask: null,
  };
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
  const sanitizedTitle = sanitizeFilename(title, `Task-${Date.now()}`);
  let taskPath = `${basePath}/${sanitizedTitle}.md`;
  let counter = 1;

  while (app.vault.getAbstractFileByPath(normalizePath(taskPath))) {
    taskPath = `${basePath}/${sanitizedTitle} (${counter}).md`;
    counter++;
  }

  return normalizePath(taskPath);
}

/**
 * Modal for confirming task creation with summary
 */
export class TaskConfirmationModal extends Modal {
  private summaries: TaskCreationSummary[];
  private operationType: "single" | "breakdown";
  private epicName: string | null;
  private onConfirm: () => void;
  private onCancel: () => void;

  constructor(
    app: App,
    summaries: TaskCreationSummary[],
    operationType: "single" | "breakdown",
    epicName: string | null,
    onConfirm: () => void,
    onCancel: () => void
  ) {
    super(app);
    this.summaries = summaries;
    this.operationType = operationType;
    this.epicName = epicName;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-confirmation-modal");

    // Header
    const headerText = this.operationType === "breakdown" 
      ? `📋 Confirm Task Creation (${this.summaries.length} tasks)`
      : "📋 Confirm Task Creation";
    contentEl.createEl("h2", { text: headerText });

    // Description
    const descText = this.operationType === "breakdown"
      ? "The following tasks will be created:"
      : "The following task will be created:";
    contentEl.createEl("p", { text: descText, cls: "modal-description" });

    // Summary list
    const listEl = contentEl.createDiv({ cls: "confirmation-task-list" });

    for (let summaryIndex = 0; summaryIndex < this.summaries.length; summaryIndex++) {
      const summary = this.summaries[summaryIndex];
      const itemEl = listEl.createDiv({ cls: "confirmation-task-item" });
      
      // Task number and title
      const titleRow = itemEl.createDiv({ cls: "task-title-row" });
      if (this.operationType === "breakdown") {
        titleRow.createEl("span", { 
          text: `${summaryIndex + 1}. `,
          cls: "task-number"
        });
      }
      titleRow.createEl("span", { text: summary.title, cls: "task-title" });
      
      // Details
      const detailsEl = itemEl.createDiv({ cls: "task-details" });
      
      // Priority badge
      detailsEl.createEl("span", { 
        text: summary.priority,
        cls: `priority-badge priority-${summary.priority}`
      });
      
      // Epic
      if (summary.epic) {
        detailsEl.createEl("span", { 
          text: `Epic: ${summary.epic}`,
          cls: "task-epic"
        });
      }
      
      // Dependency
      if (summary.dependsOnTask) {
        detailsEl.createEl("span", { 
          text: `→ Depends on: ${summary.dependsOnTask}`,
          cls: "task-dependency"
        });
      }
      
      // Target folder
      const folderEl = itemEl.createDiv({ cls: "task-folder" });
      folderEl.createEl("span", { 
        text: `📁 ${summary.targetFolder}`,
        cls: "folder-path"
      });
    }

    // Buttons
    const buttonsEl = contentEl.createDiv({ cls: "modal-button-container" });

    const cancelBtn = buttonsEl.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = (): void => {
      this.close();
      this.onCancel();
    };

    const confirmText = this.operationType === "breakdown"
      ? `✓ Create ${this.summaries.length} Tasks`
      : "✓ Create Task";
    const confirmBtn = buttonsEl.createEl("button", { 
      text: confirmText,
      cls: "mod-cta"
    });
    confirmBtn.onclick = (): void => {
      this.close();
      this.onConfirm();
    };
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Show confirmation dialog for task creation
 * Returns a promise that resolves to true if confirmed, false if cancelled
 */
export function showTaskConfirmation(
  app: App,
  summaries: TaskCreationSummary[],
  operationType: "single" | "breakdown",
  epicName: string | null
): Promise<boolean> {
  return new Promise((resolve) => {
    new TaskConfirmationModal(
      app,
      summaries,
      operationType,
      epicName,
      () => resolve(true),
      () => resolve(false)
    ).open();
  });
}

