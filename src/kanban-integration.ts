/**
 * Kanban Integration Module for GPT Task Manager
 * 
 * This module provides integration between GPT Task Manager and obsidian-base-kanban plugin,
 * allowing users to view and manage tasks in a Kanban board format.
 * 
 * Key features:
 * - Generate Kanban board files from GPT Task Manager tasks
 * - Filter tasks by Epic, Project, or view all tasks
 * - Sync task status with Kanban lanes
 * - Open Kanban boards in obsidian-base-kanban view
 */

import { App, TFile, TFolder, Notice, normalizePath } from "obsidian";
import type { GptTaskManagerSettings } from "./settings";

/**
 * Task metadata extracted from GPT Task Manager task files
 */
export interface GptTaskMetadata {
  type?: string;
  area?: string;
  goal?: string;
  project?: string;
  epic?: string;
  status?: string;
  priority?: string;
  due?: string;
  created?: string;
  updated?: string;
  parent?: string;
  tags?: string[];
  description?: string;
}

/**
 * Parsed GPT Task Manager task
 */
export interface GptTask {
  file: TFile;
  title: string;
  metadata: GptTaskMetadata;
  syncChecklistItem?: string;
  completed: boolean;
  content: string;
}

/**
 * Kanban card representation
 */
export interface KanbanCard {
  id: string;
  title: string;
  completed: boolean;
  tags: string[];
  dueDate?: string;
  metadata: {
    project?: string;
    priority?: string;
    status?: string;
  };
  baseTaskPath: string;
  baseSyncTime: number;
}

/**
 * Kanban lane representation
 */
export interface KanbanLane {
  id: string;
  title: string;
  cards: KanbanCard[];
}

/**
 * Kanban board representation
 */
export interface KanbanBoard {
  lanes: KanbanLane[];
  archive: KanbanCard[];
  settings: Record<string, unknown>;
  _frontmatter?: string;
}

/**
 * Filter options for querying tasks
 */
export interface TaskFilter {
  epic?: string;
  project?: string;
  status?: string[];
  includeCompleted?: boolean;
}

/**
 * Kanban Integration Service
 */
export class KanbanIntegrationService {
  private app: App;
  private settings: GptTaskManagerSettings;

  constructor(app: App, settings: GptTaskManagerSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: GptTaskManagerSettings): void {
    this.settings = settings;
  }

  /**
   * Check if obsidian-base-kanban plugin is available
   */
  isKanbanPluginAvailable(): boolean {
    // Check if the kanban plugin is loaded
    const kanbanPlugin = (this.app as unknown as { plugins: { plugins: Record<string, unknown> } }).plugins?.plugins?.["obsidian-base-kanban"];
    return !!kanbanPlugin;
  }

  /**
   * Parse frontmatter from a task file
   */
  private parseTaskFrontmatter(content: string): GptTaskMetadata {
    const metadata: GptTaskMetadata = {};
    
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return metadata;
    }
    
    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split("\n");
    
    for (const line of lines) {
      const kvMatch = line.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        let value = kvMatch[2].trim();
        
        // Remove quotes and wiki-link brackets
        value = value.replace(/^["']|["']$/g, "");
        value = value.replace(/^\[\[|\]\]$/g, "");
        
        switch (key.toLowerCase()) {
          case "type":
            metadata.type = value;
            break;
          case "area":
            metadata.area = value;
            break;
          case "goal":
            metadata.goal = value;
            break;
          case "project":
            metadata.project = value;
            break;
          case "epic":
            metadata.epic = value;
            break;
          case "status":
            metadata.status = value;
            break;
          case "priority":
            metadata.priority = value;
            break;
          case "due":
            metadata.due = value;
            break;
          case "created":
            metadata.created = value;
            break;
          case "updated":
            metadata.updated = value;
            break;
          case "parent":
            metadata.parent = value;
            break;
          case "description":
            metadata.description = value;
            break;
          case "tags":
            if (value.startsWith("[")) {
              metadata.tags = value.replace(/[\[\]]/g, "").split(",").map(t => t.trim());
            }
            break;
        }
      }
      
      // Handle multi-line tags
      if (line.trim().startsWith("- ") && metadata.tags === undefined) {
        const tagValue = line.trim().replace(/^-\s*/, "");
        if (!metadata.tags) {
          metadata.tags = [];
        }
        metadata.tags.push(tagValue);
      }
    }
    
    return metadata;
  }

  /**
   * Extract sync checklist item from task content
   */
  private extractSyncChecklistItem(content: string): { text: string; completed: boolean } | null {
    const syncSectionMatch = content.match(/## 🔄 Sync\s*\n([\s\S]*?)(?=\n## |$)/);
    if (!syncSectionMatch) {
      return null;
    }
    
    const syncSection = syncSectionMatch[1];
    const checkboxMatch = syncSection.match(/-\s*\[([ xX])\]\s*(.+)/);
    if (!checkboxMatch) {
      return null;
    }
    
    return {
      completed: checkboxMatch[1].toLowerCase() === "x",
      text: checkboxMatch[2].trim(),
    };
  }

  /**
   * Parse a single task file
   */
  async parseTaskFile(file: TFile): Promise<GptTask | null> {
    try {
      const content = await this.app.vault.read(file);
      const metadata = this.parseTaskFrontmatter(content);
      
      // Check if this looks like a GPT Task Manager task
      if (!metadata.type || !metadata.type.includes("Tasks")) {
        return null;
      }
      
      const syncItem = this.extractSyncChecklistItem(content);
      const title = syncItem?.text || file.basename;
      
      return {
        file,
        title,
        metadata,
        syncChecklistItem: syncItem?.text,
        completed: syncItem?.completed || false,
        content,
      };
    } catch (error) {
      console.error(`Failed to parse task file: ${file.path}`, error);
      return null;
    }
  }

  /**
   * Query all tasks from the tasks folder
   */
  async queryTasks(filter?: TaskFilter): Promise<GptTask[]> {
    const tasks: GptTask[] = [];
    
    const folder = this.app.vault.getAbstractFileByPath(this.settings.tasksFolder);
    if (!(folder instanceof TFolder)) {
      console.warn(`Tasks folder not found: ${this.settings.tasksFolder}`);
      return tasks;
    }
    
    // Recursively get all markdown files
    const getAllMarkdownFiles = (folder: TFolder): TFile[] => {
      const files: TFile[] = [];
      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === "md") {
          files.push(child);
        } else if (child instanceof TFolder) {
          files.push(...getAllMarkdownFiles(child));
        }
      }
      return files;
    };
    
    const files = getAllMarkdownFiles(folder);
    
    for (const file of files) {
      const task = await this.parseTaskFile(file);
      if (!task) continue;
      
      // Apply filters
      if (filter) {
        if (filter.epic && task.metadata.epic !== filter.epic) {
          continue;
        }
        if (filter.project && task.metadata.project !== filter.project) {
          continue;
        }
        if (filter.status && filter.status.length > 0 && task.metadata.status) {
          if (!filter.status.includes(task.metadata.status)) {
            continue;
          }
        }
        if (!filter.includeCompleted && task.completed) {
          continue;
        }
      }
      
      tasks.push(task);
    }
    
    return tasks;
  }

  /**
   * Convert task status to lane title
   */
  statusToLane(status: string | undefined): string {
    if (!status) return this.settings.kanbanStatusMapping.backlog;
    
    const statusLower = status.toLowerCase();
    
    if (statusLower === "backlog") return this.settings.kanbanStatusMapping.backlog;
    if (statusLower === "todo") return this.settings.kanbanStatusMapping.todo;
    if (statusLower === "in-progress" || statusLower === "inprogress") {
      return this.settings.kanbanStatusMapping.inProgress;
    }
    if (statusLower === "done" || statusLower === "completed") {
      return this.settings.kanbanStatusMapping.done;
    }
    
    return this.settings.kanbanStatusMapping.backlog;
  }

  /**
   * Convert lane title to task status
   */
  laneToStatus(laneTitle: string): string {
    const laneLower = laneTitle.toLowerCase();
    const mapping = this.settings.kanbanStatusMapping;
    
    if (laneLower === mapping.backlog.toLowerCase() || laneLower.includes("backlog")) {
      return "backlog";
    }
    if (laneLower === mapping.todo.toLowerCase() || laneLower.includes("todo")) {
      return "todo";
    }
    if (laneLower === mapping.inProgress.toLowerCase() || laneLower.includes("progress")) {
      return "in-progress";
    }
    if (laneLower === mapping.done.toLowerCase() || laneLower.includes("done")) {
      return "done";
    }
    
    return "backlog";
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36).slice(-4);
  }

  /**
   * Convert a GptTask to a KanbanCard
   */
  taskToCard(task: GptTask): KanbanCard {
    return {
      id: this.generateId(),
      title: task.title,
      completed: task.completed,
      tags: task.metadata.tags || [],
      dueDate: task.metadata.due,
      metadata: {
        project: task.metadata.project,
        priority: task.metadata.priority,
        status: task.metadata.status,
      },
      baseTaskPath: task.file.path,
      baseSyncTime: Date.now(),
    };
  }

  /**
   * Create a Kanban board from tasks
   */
  createBoardFromTasks(tasks: GptTask[], boardTitle?: string): KanbanBoard {
    const mapping = this.settings.kanbanStatusMapping;
    
    // Create lanes based on status mapping
    const lanes: KanbanLane[] = [
      { id: this.generateId(), title: mapping.backlog, cards: [] },
      { id: this.generateId(), title: mapping.todo, cards: [] },
      { id: this.generateId(), title: mapping.inProgress, cards: [] },
      { id: this.generateId(), title: mapping.done, cards: [] },
    ];
    
    // Sort tasks into lanes based on status
    for (const task of tasks) {
      const card = this.taskToCard(task);
      const laneTitle = this.statusToLane(task.metadata.status);
      
      const lane = lanes.find(l => l.title === laneTitle);
      if (lane) {
        lane.cards.push(card);
      } else {
        // Default to first lane (Backlog)
        lanes[0].cards.push(card);
      }
    }
    
    // Sort cards by priority within each lane
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    
    for (const lane of lanes) {
      lane.cards.sort((a, b) => {
        const aPriority = priorityOrder[a.metadata.priority || "medium"] ?? 2;
        const bPriority = priorityOrder[b.metadata.priority || "medium"] ?? 2;
        return aPriority - bPriority;
      });
    }
    
    return {
      lanes,
      archive: [],
      settings: {
        "lane-width": "300px",
        "show-checkboxes": true,
        "show-progress": true,
        "show-project": true,
        "base-sync": {
          enabled: true,
          tasksFolder: this.settings.tasksFolder,
          query: "",
          statusField: "Status",
          progressField: "progress",
          projectField: "Project",
          laneMapping: {
            [mapping.backlog]: "backlog",
            [mapping.todo]: "todo",
            [mapping.inProgress]: "in-progress",
            [mapping.done]: "done",
          },
          conflictResolution: "prompt",
          syncInterval: 0,
          createMissingTasks: false,
          archiveCompletedTasks: false,
        },
        "gpt-task-manager": {
          enabled: true,
          tasksFolder: this.settings.tasksFolder,
          epicsFolder: this.settings.epicsFolder,
          projectsFolder: this.settings.projectsFolder,
          goalsFolder: this.settings.goalsFolder,
        },
      },
      _frontmatter: `---\nkanban-plugin: basic\ntitle: ${boardTitle || "Task Board"}\ngpt-task-manager: true\n---\n\n`,
    };
  }

  /**
   * Serialize a Kanban board to markdown format
   */
  serializeBoard(board: KanbanBoard): string {
    const lines: string[] = [];
    
    // Add frontmatter
    if (board._frontmatter) {
      lines.push(board._frontmatter);
    } else {
      lines.push("---");
      lines.push("kanban-plugin: basic");
      lines.push("gpt-task-manager: true");
      lines.push("---");
      lines.push("");
    }
    
    // Add lanes
    for (const lane of board.lanes) {
      lines.push(`## ${lane.title}`);
      lines.push("");
      
      for (const card of lane.cards) {
        let cardLine = `- [${card.completed ? "x" : " "}] `;
        
        // Add title (with link to task file if available)
        if (card.baseTaskPath) {
          cardLine += `[[${card.baseTaskPath}|${card.title}]]`;
        } else {
          cardLine += card.title;
        }
        
        // Add date if present
        if (card.dueDate) {
          cardLine += ` @{${card.dueDate}}`;
        }
        
        // Add tags
        for (const tag of card.tags) {
          if (!cardLine.includes(`#${tag}`)) {
            cardLine += ` #${tag}`;
          }
        }
        
        // Add metadata
        if (card.metadata.priority) {
          cardLine += ` [priority::${card.metadata.priority}]`;
        }
        if (card.metadata.project) {
          cardLine += ` [project::${card.metadata.project}]`;
        }
        
        lines.push(cardLine);
      }
      
      lines.push("");
    }
    
    // Add archive section if there are archived cards
    if (board.archive.length > 0) {
      lines.push("## Archive");
      lines.push("");
      for (const card of board.archive) {
        let cardLine = `- [x] ${card.title}`;
        if (card.dueDate) {
          cardLine += ` @{${card.dueDate}}`;
        }
        lines.push(cardLine);
      }
      lines.push("");
    }
    
    // Add settings block
    lines.push("%% kanban:settings");
    lines.push("```");
    lines.push(JSON.stringify(board.settings, null, 2));
    lines.push("```");
    lines.push("%%");
    
    return lines.join("\n");
  }

  /**
   * Ensure the Kanban boards folder exists
   */
  async ensureBoardsFolderExists(): Promise<void> {
    const folderPath = normalizePath(this.settings.kanbanBoardsFolder);
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  /**
   * Create or update a Kanban board file
   */
  async createOrUpdateBoard(
    boardName: string,
    tasks: GptTask[],
    options?: { filter?: TaskFilter; overwrite?: boolean }
  ): Promise<TFile> {
    await this.ensureBoardsFolderExists();
    
    const board = this.createBoardFromTasks(tasks, boardName);
    const content = this.serializeBoard(board);
    
    // Sanitize board name for file path
    const sanitizedName = boardName.replace(/[\\/:*?"<>|]/g, "");
    const filePath = normalizePath(`${this.settings.kanbanBoardsFolder}/${sanitizedName}.md`);
    
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    
    if (existingFile instanceof TFile) {
      if (options?.overwrite !== false) {
        await this.app.vault.modify(existingFile, content);
        return existingFile;
      }
      // Return existing file without modification
      return existingFile;
    }
    
    // Create new file
    return await this.app.vault.create(filePath, content);
  }

  /**
   * Open a Kanban board in the workspace
   */
  async openBoard(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    
    // Try to open in Kanban view if plugin is available
    if (this.isKanbanPluginAvailable()) {
      await leaf.setViewState({
        type: "kanban",
        state: { file: file.path },
      });
    } else {
      // Fall back to markdown view
      await leaf.openFile(file);
    }
  }

  /**
   * Create and open a Kanban board for all tasks
   */
  async openAllTasksBoard(): Promise<void> {
    const tasks = await this.queryTasks({ includeCompleted: false });
    
    if (tasks.length === 0) {
      new Notice("No active tasks found");
      return;
    }
    
    const file = await this.createOrUpdateBoard(
      this.settings.defaultKanbanBoardName,
      tasks,
      { overwrite: true }
    );
    
    await this.openBoard(file);
    new Notice(`Opened Kanban board with ${tasks.length} tasks`);
  }

  /**
   * Create and open a Kanban board for an Epic
   */
  async openEpicBoard(epicName: string): Promise<void> {
    const tasks = await this.queryTasks({
      epic: epicName,
      includeCompleted: true,
    });
    
    if (tasks.length === 0) {
      new Notice(`No tasks found for Epic: ${epicName}`);
      return;
    }
    
    const boardName = `${epicName} Board`;
    const file = await this.createOrUpdateBoard(boardName, tasks, { overwrite: true });
    
    await this.openBoard(file);
    new Notice(`Opened Kanban board with ${tasks.length} tasks from Epic: ${epicName}`);
  }

  /**
   * Create and open a Kanban board for a Project
   */
  async openProjectBoard(projectName: string): Promise<void> {
    const tasks = await this.queryTasks({
      project: projectName,
      includeCompleted: true,
    });
    
    if (tasks.length === 0) {
      new Notice(`No tasks found for Project: ${projectName}`);
      return;
    }
    
    const boardName = `${projectName} Board`;
    const file = await this.createOrUpdateBoard(boardName, tasks, { overwrite: true });
    
    await this.openBoard(file);
    new Notice(`Opened Kanban board with ${tasks.length} tasks from Project: ${projectName}`);
  }

  /**
   * Get available epics
   */
  async getEpics(): Promise<string[]> {
    const epics: string[] = [];
    
    const folder = this.app.vault.getAbstractFileByPath(this.settings.epicsFolder);
    if (!(folder instanceof TFolder)) {
      return epics;
    }
    
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        epics.push(child.basename);
      }
    }
    
    return epics.sort();
  }

  /**
   * Get available projects
   */
  async getProjects(): Promise<string[]> {
    const projects: string[] = [];
    
    const folder = this.app.vault.getAbstractFileByPath(this.settings.projectsFolder);
    if (!(folder instanceof TFolder)) {
      return projects;
    }
    
    const getAllProjects = (folder: TFolder): string[] => {
      const names: string[] = [];
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          names.push(child.name);
          names.push(...getAllProjects(child));
        } else if (child instanceof TFile && child.extension === "md") {
          names.push(child.basename);
        }
      }
      return names;
    };
    
    return getAllProjects(folder).sort();
  }

  /**
   * Update task status in the task file
   */
  async updateTaskStatus(taskPath: string, newStatus: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(taskPath);
      if (!(file instanceof TFile)) {
        console.warn(`Task file not found: ${taskPath}`);
        return false;
      }
      
      let content = await this.app.vault.read(file);
      
      // Update status in frontmatter
      const statusRegex = /^(Status:)\s*.+$/mi;
      if (statusRegex.test(content)) {
        content = content.replace(statusRegex, `$1 ${newStatus}`);
      } else {
        // Add status field if not present
        const frontmatterEndMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (frontmatterEndMatch) {
          const frontmatter = frontmatterEndMatch[1];
          const newFrontmatter = frontmatter + `\nStatus: ${newStatus}`;
          content = content.replace(frontmatterEndMatch[1], newFrontmatter);
        }
      }
      
      // Update the Updated timestamp
      const updatedRegex = /^(Updated:)\s*.+$/mi;
      const now = new Date();
      const timestamp = `"${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}"`;
      if (updatedRegex.test(content)) {
        content = content.replace(updatedRegex, `$1 ${timestamp}`);
      }
      
      await this.app.vault.modify(file, content);
      return true;
    } catch (error) {
      console.error(`Failed to update task status: ${taskPath}`, error);
      return false;
    }
  }
}

