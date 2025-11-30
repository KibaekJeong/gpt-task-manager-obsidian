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
 * Ensure a folder exists, recursively creating parent directories if needed
 * Surfaces clear errors if folder creation fails
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath);
  
  // Check if already exists
  const existingFolder = app.vault.getAbstractFileByPath(normalizedPath);
  if (existingFolder && existingFolder instanceof TFolder) {
    return;
  }

  // Build list of folders to create (from root to target)
  const pathParts = normalizedPath.split("/").filter(part => part.length > 0);
  const foldersToCreate: string[] = [];
  let currentPath = "";

  for (const part of pathParts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(currentPath);
    
    if (!existing) {
      foldersToCreate.push(currentPath);
    } else if (existing instanceof TFile) {
      // A file exists at this path - can't create folder
      throw new Error(`Cannot create folder "${currentPath}": a file exists at this path`);
    }
  }

  // Create folders in order (parent first)
  for (const folderToCreate of foldersToCreate) {
    try {
      // Double-check it doesn't exist (race condition guard)
      const recheck = app.vault.getAbstractFileByPath(folderToCreate);
      if (!recheck) {
        await app.vault.createFolder(folderToCreate);
      }
    } catch (error) {
      // Check if folder was created by a concurrent call
      const afterError = app.vault.getAbstractFileByPath(folderToCreate);
      if (afterError && afterError instanceof TFolder) {
        // Created by concurrent call, continue
        continue;
      }
      // Actual error - surface it
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create folder "${folderToCreate}": ${errorMessage}`);
    }
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
 * Note: YAML frontmatter must use spaces for indentation (tabs are not allowed)
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
    // Escape quotes and newlines for YAML string safety
    return value.replace(/"/g, '\\"').replace(/\n/g, " ");
  };

  // Format tags with explicit spaces (YAML disallows tabs)
  const formatTags = (tags: string[] | undefined): string => {
    const YAML_INDENT = "  "; // Two spaces for YAML list items
    if (!tags || tags.length === 0) {
      return `${YAML_INDENT}- tasks`;
    }
    return tags.map(tag => `${YAML_INDENT}- ${tag.startsWith("#") ? tag.substring(1) : tag}`).join("\n");
  };

  // Build frontmatter with explicit spaces (no tabs allowed in YAML)
  // Each line starts at column 0 (no indentation for top-level keys)
  const frontmatterLines = [
    "---",
    'Type: "[[Tasks]]"',
    `Area: ${formatLink(params.area)}`,
    `Goal: ${formatLink(params.goal)}`,
    `Project: ${formatLink(params.project)}`,
    `Epic: ${formatLink(params.epic)}`,
    `Status: ${params.status || settings.defaultStatus}`,
    `Priority: ${params.priority || settings.defaultPriority}`,
    `Due: ${params.due || ""}`,
    `Created: "${createdAt}"`,
    `Updated: "${updatedAt}"`,
    "tags:",
    formatTags(params.tags),
    "Cover: ",
    `Description: "${formatString(params.objective)}"`,
    "Topics: ",
    `Parent: ${params.parent ? formatLink(params.parent) : "Empty"}`,
    "---",
  ];
  
  const frontmatter = frontmatterLines.join("\n");

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
 * Uses two-pass approach to handle forward/out-of-order dependencies:
 * 1. First pass: Create all files (with backward dependencies resolved)
 * 2. Second pass: Update files with forward dependencies
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
  // Map from task index (0-based) to created file
  const indexToFile: Map<number, TFile> = new Map();
  // Track tasks with forward dependencies (dependsOn >= taskIndex)
  const forwardDependencies: { taskIndex: number; dependsOnIndex: number }[] = [];

  // Ensure base folders exist before creating any tasks
  await ensureFolderExists(app, settings.tasksFolder);
  if (epicName) {
    const sanitizedEpicName = sanitizeFilename(epicName, "Untitled Epic");
    await ensureFolderExists(app, `${settings.tasksFolder}/active epic folder`);
    await ensureFolderExists(app, `${settings.tasksFolder}/active epic folder/${sanitizedEpicName}`);
  }

  // PASS 1: Create all files, resolving backward dependencies only
  for (let taskIndex = 0; taskIndex < breakdown.tasks.length; taskIndex++) {
    const task = breakdown.tasks[taskIndex];
    
    // Resolve dependency
    let parentBasename: string | undefined = undefined;
    if (task.dependsOn !== null && task.dependsOn !== undefined) {
      const dependsOnIndex = task.dependsOn;
      
      // Validate index is in range
      if (dependsOnIndex >= 0 && dependsOnIndex < breakdown.tasks.length) {
        if (dependsOnIndex < taskIndex) {
          // Backward dependency - resolve now
          const dependsOnFile = indexToFile.get(dependsOnIndex);
          if (dependsOnFile) {
            parentBasename = dependsOnFile.basename;
          }
        } else if (dependsOnIndex > taskIndex) {
          // Forward dependency - mark for second pass
          forwardDependencies.push({ taskIndex, dependsOnIndex });
        }
        // Self-reference (dependsOnIndex === taskIndex) is ignored
      }
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
      indexToFile.set(taskIndex, file);
    } catch (error) {
      console.error(`[GPT Task Manager] Failed to create task: ${task.title}`, error);
      new Notice(`Failed to create task: ${task.title}`);
    }
  }

  // PASS 2: Update files with forward dependencies
  for (const { taskIndex, dependsOnIndex } of forwardDependencies) {
    const file = indexToFile.get(taskIndex);
    const dependsOnFile = indexToFile.get(dependsOnIndex);
    
    if (file && dependsOnFile) {
      try {
        await updateTaskParent(app, file, dependsOnFile.basename);
      } catch (error) {
        console.error(`[GPT Task Manager] Failed to update dependency for: ${file.basename}`, error);
        // Non-fatal: task is created, just missing the link
      }
    }
  }

  return createdFiles;
}

/**
 * Update the Parent field in a task's frontmatter
 */
async function updateTaskParent(app: App, file: TFile, parentBasename: string): Promise<void> {
  const content = await app.vault.read(file);
  
  // Find and update the Parent field in frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return;
  }

  const frontmatter = frontmatterMatch[1];
  const parentPattern = /^Parent:\s*.*/m;
  
  if (parentPattern.test(frontmatter)) {
    const newFrontmatter = frontmatter.replace(
      parentPattern,
      `Parent: "[[${parentBasename}]]"`
    );
    const newContent = content.replace(
      /^---\n[\s\S]*?\n---/,
      `---\n${newFrontmatter}\n---`
    );
    await app.vault.modify(file, newContent);
  }
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
  private resolved: boolean = false;

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
      this.resolved = true;
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
      this.resolved = true;
      this.close();
      this.onConfirm();
    };
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    
    // If modal was closed via Esc/overlay without explicit confirm/cancel, treat as cancel
    if (!this.resolved) {
      this.resolved = true;
      this.onCancel();
    }
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

