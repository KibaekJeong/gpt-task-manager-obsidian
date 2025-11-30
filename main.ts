import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  TFile,
  TFolder,
  FuzzySuggestModal,
  SuggestModal,
  normalizePath,
} from "obsidian";

import {
  GptTaskManagerSettings,
  DEFAULT_SETTINGS,
  GptTaskManagerSettingTab,
} from "./src/settings";

import {
  callGptApi,
  fillPromptTemplate,
  parseTaskSuggestion,
  parseTaskBreakdown,
  TaskSuggestion,
  TaskBreakdown,
} from "./src/gpt-service";

import {
  VoiceRecordingModal,
  transcribeAudio,
  parseVoiceTaskInput,
  VoiceTaskInput,
} from "./src/voice";

import {
  loadUserContext,
  formatContextForPrompt,
  loadEpics,
  getEpicMetadata,
  EpicContext,
  UserContext,
} from "./src/context-loader";

import {
  createTaskFile,
  createTasksFromBreakdown,
  generateTaskContent,
  generateTaskFromSuggestion,
  CreateTaskParams,
  ensureFolderExists,
  sanitizeFilename,
  buildBreakdownSummaries,
  buildSuggestionSummary,
  showTaskConfirmation,
  TaskCreationSummary,
} from "./src/task-creator";

// New infrastructure imports
import { CancellationToken, setRateLimitConfig } from "./src/api-client";
import { logger, LogLevel } from "./src/logger";
import { ContextCache } from "./src/cache";
import { setLocale, t, SupportedLocale } from "./src/i18n";
import { showNotice, showErrorNotice, showSuccessNotice } from "./src/ui-components";

/**
 * Modal for quick task input
 */
class QuickTaskModal extends Modal {
  private inputEl: HTMLTextAreaElement | null = null;
  private onSubmit: (input: string) => void;

  constructor(app: App, onSubmit: (input: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-quick-modal");

    contentEl.createEl("h2", { text: "🚀 Quick Task Creation" });
    contentEl.createEl("p", { 
      text: "Describe your task naturally. GPT will help structure it based on your goals and projects.",
      cls: "modal-description"
    });

    this.inputEl = contentEl.createEl("textarea", {
      placeholder: "e.g., Create a landing page for the Freedom Runway project with high priority",
    });
    this.inputEl.style.width = "100%";
    this.inputEl.style.minHeight = "100px";
    this.inputEl.style.marginBottom = "16px";
    this.inputEl.style.padding = "12px";
    this.inputEl.style.fontSize = "14px";
    this.inputEl.style.borderRadius = "8px";

    // Handle Enter (without shift) for submit
    this.inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        this.submit();
      }
    });

    const buttonsEl = contentEl.createDiv({ cls: "modal-button-container" });

    const cancelBtn = buttonsEl.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = (): void => this.close();

    const submitBtn = buttonsEl.createEl("button", { text: "✨ Create with AI", cls: "mod-cta" });
    submitBtn.onclick = (): void => this.submit();

    this.inputEl.focus();
  }

  private submit(): void {
    const input = this.inputEl?.value.trim();
    if (input) {
      this.close();
      this.onSubmit(input);
    } else {
      new Notice("Please enter a task description");
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for selecting an epic
 */
class EpicSelectModal extends FuzzySuggestModal<EpicContext> {
  private epics: EpicContext[];
  private onChoose: (epic: EpicContext) => void;

  constructor(app: App, epics: EpicContext[], onChoose: (epic: EpicContext) => void) {
    super(app);
    this.epics = epics;
    this.onChoose = onChoose;
    this.setPlaceholder("Select an epic to break down...");
  }

  getItems(): EpicContext[] {
    return this.epics;
  }

  getItemText(item: EpicContext): string {
    const status = item.status ? ` [${item.status}]` : "";
    const project = item.project ? ` - ${item.project}` : "";
    return `${item.name}${status}${project}`;
  }

  onChooseItem(item: EpicContext, evt: MouseEvent | KeyboardEvent): void {
    this.onChoose(item);
  }
}

/**
 * Modal for reviewing and confirming task creation
 */
class TaskReviewModal extends Modal {
  private suggestion: TaskSuggestion;
  private epics: EpicContext[];
  private onConfirm: (suggestion: TaskSuggestion, selectedEpic: string | null) => void;
  private onCancel: () => void;
  private selectedEpic: string | null;
  private resolved: boolean = false;

  constructor(
    app: App,
    suggestion: TaskSuggestion,
    epics: EpicContext[],
    onConfirm: (suggestion: TaskSuggestion, selectedEpic: string | null) => void,
    onCancel: () => void
  ) {
    super(app);
    this.suggestion = suggestion;
    this.epics = epics;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.selectedEpic = suggestion.suggestedEpic;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-review-modal");

    contentEl.createEl("h2", { text: "📋 Review Task" });

    // Task details form
    const formEl = contentEl.createDiv({ cls: "task-review-form" });

    // Title
    const titleGroup = formEl.createDiv({ cls: "form-group" });
    titleGroup.createEl("label", { text: "Title" });
    const titleInput = titleGroup.createEl("input", { type: "text", value: this.suggestion.title });
    titleInput.style.width = "100%";
    titleInput.addEventListener("change", () => {
      this.suggestion.title = titleInput.value;
    });

    // Objective
    const objectiveGroup = formEl.createDiv({ cls: "form-group" });
    objectiveGroup.createEl("label", { text: "Objective" });
    const objectiveInput = objectiveGroup.createEl("textarea", { text: this.suggestion.objective });
    objectiveInput.style.width = "100%";
    objectiveInput.rows = 3;
    objectiveInput.addEventListener("change", () => {
      this.suggestion.objective = objectiveInput.value;
    });

    // Importance
    const importanceGroup = formEl.createDiv({ cls: "form-group" });
    importanceGroup.createEl("label", { text: "Why it matters" });
    const importanceInput = importanceGroup.createEl("textarea", { text: this.suggestion.importance });
    importanceInput.style.width = "100%";
    importanceInput.rows = 2;
    importanceInput.addEventListener("change", () => {
      this.suggestion.importance = importanceInput.value;
    });

    // Epic Selection
    const epicGroup = formEl.createDiv({ cls: "form-group" });
    epicGroup.createEl("label", { text: "Epic" });
    const epicSelect = epicGroup.createEl("select");
    epicSelect.style.width = "100%";

    // Add "None" option
    const noneOption = epicSelect.createEl("option", { text: "-- No Epic --", value: "" });

    // Add epic options
    for (const epic of this.epics) {
      const option = epicSelect.createEl("option", {
        text: `${epic.name} (${epic.status || "active"})`,
        value: epic.name,
      });
      if (epic.name === this.suggestion.suggestedEpic) {
        option.selected = true;
      }
    }

    epicSelect.addEventListener("change", () => {
      this.selectedEpic = epicSelect.value || null;
    });

    // Priority
    const priorityGroup = formEl.createDiv({ cls: "form-group" });
    priorityGroup.createEl("label", { text: "Priority" });
    const prioritySelect = priorityGroup.createEl("select");
    prioritySelect.style.width = "100%";

    const priorities = [
      { value: "low", text: "Low" },
      { value: "medium", text: "Medium" },
      { value: "high", text: "High" },
      { value: "critical", text: "Critical" },
    ];

    for (const priority of priorities) {
      const option = prioritySelect.createEl("option", {
        text: priority.text,
        value: priority.value,
      });
      if (priority.value === this.suggestion.priority) {
        option.selected = true;
      }
    }

    prioritySelect.addEventListener("change", () => {
      this.suggestion.priority = prioritySelect.value;
    });

    // Subtasks preview (if any)
    if (this.suggestion.subtasks.length > 0) {
      const subtasksGroup = formEl.createDiv({ cls: "form-group" });
      subtasksGroup.createEl("label", { text: `Suggested Subtasks (${this.suggestion.subtasks.length})` });
      const subtasksList = subtasksGroup.createEl("ul", { cls: "subtasks-preview" });
      for (const subtask of this.suggestion.subtasks) {
        subtasksList.createEl("li", { text: subtask });
      }
    }

    // Buttons
    const buttonsEl = contentEl.createDiv({ cls: "modal-button-container" });

    const cancelBtn = buttonsEl.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = (): void => {
      this.resolved = true;
      this.close();
      this.onCancel();
    };

    const confirmBtn = buttonsEl.createEl("button", { text: "✓ Create Task", cls: "mod-cta" });
    confirmBtn.onclick = (): void => {
      this.resolved = true;
      this.close();
      this.onConfirm(this.suggestion, this.selectedEpic);
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
 * Modal for reviewing task breakdown
 */
class BreakdownReviewModal extends Modal {
  private breakdown: TaskBreakdown;
  private epicName: string;
  private onConfirm: (breakdown: TaskBreakdown) => void;
  private onCancel: () => void;
  private resolved: boolean = false;

  constructor(
    app: App,
    breakdown: TaskBreakdown,
    epicName: string,
    onConfirm: (breakdown: TaskBreakdown) => void,
    onCancel: () => void
  ) {
    super(app);
    this.breakdown = breakdown;
    this.epicName = epicName;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-breakdown-modal");

    contentEl.createEl("h2", { text: `📊 Task Breakdown: ${this.epicName}` });
    contentEl.createEl("p", { 
      text: `${this.breakdown.tasks.length} tasks will be created:`,
      cls: "modal-description"
    });

    const taskListEl = contentEl.createDiv({ cls: "breakdown-task-list" });

    for (let index = 0; index < this.breakdown.tasks.length; index++) {
      const task = this.breakdown.tasks[index];
      const taskEl = taskListEl.createDiv({ cls: "breakdown-task-item" });

      const headerEl = taskEl.createDiv({ cls: "task-header" });
      headerEl.createEl("span", { text: `${index + 1}. ${task.title}`, cls: "task-title" });
      headerEl.createEl("span", { 
        text: task.priority,
        cls: `task-priority priority-${task.priority}`
      });

      if (task.objective) {
        taskEl.createEl("p", { text: task.objective, cls: "task-objective" });
      }

      if (task.dependsOn !== null) {
        taskEl.createEl("span", { 
          text: `Depends on: Task ${task.dependsOn + 1}`,
          cls: "task-dependency"
        });
      }
    }

    // Buttons
    const buttonsEl = contentEl.createDiv({ cls: "modal-button-container" });

    const cancelBtn = buttonsEl.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = (): void => {
      this.resolved = true;
      this.close();
      this.onCancel();
    };

    const confirmBtn = buttonsEl.createEl("button", { 
      text: `✓ Create ${this.breakdown.tasks.length} Tasks`,
      cls: "mod-cta"
    });
    confirmBtn.onclick = (): void => {
      this.resolved = true;
      this.close();
      this.onConfirm(this.breakdown);
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
 * GPT Task Manager Plugin
 */
export default class GptTaskManagerPlugin extends Plugin {
  settings: GptTaskManagerSettings = DEFAULT_SETTINGS;
  private contextCache: ContextCache | null = null;
  private activeCancellationToken: CancellationToken | null = null;

  async onload(): Promise<void> {
    logger.info("Plugin", "Loading GPT Task Manager plugin...");

    await this.loadSettings();
    this.initializeInfrastructure();

    // Add settings tab
    this.addSettingTab(new GptTaskManagerSettingTab(this.app, this));

    // Add ribbon icons
    this.addRibbonIcon("plus-circle", "Quick Task (GPT)", () => {
      this.showQuickTaskModal();
    });

    this.addRibbonIcon("mic", "Voice Task", () => {
      this.startVoiceTask();
    });

    // Commands
    this.addCommand({
      id: "gpt-task-quick-create",
      name: "Quick Task Creation (GPT Assisted)",
      callback: () => this.showQuickTaskModal(),
    });

    this.addCommand({
      id: "gpt-task-voice-create",
      name: "Voice Task Creation",
      callback: () => this.startVoiceTask(),
    });

    this.addCommand({
      id: "gpt-task-breakdown-epic",
      name: "Break Down Epic into Tasks",
      callback: () => this.showEpicBreakdownModal(),
    });

    this.addCommand({
      id: "gpt-task-simple-create",
      name: "Simple Task Creation (No AI)",
      callback: () => this.showSimpleTaskModal(),
    });

    this.addCommand({
      id: "gpt-task-from-selection",
      name: "Create Task from Selection (GPT)",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.createTaskFromSelection(editor);
      },
    });

    logger.info("Plugin", "GPT Task Manager loaded successfully");
  }

  onunload(): void {
    logger.info("Plugin", "Unloading GPT Task Manager plugin...");
    
    // Cleanup
    if (this.contextCache) {
      this.contextCache.destroy();
      this.contextCache = null;
    }
    
    // Cancel any active operations
    if (this.activeCancellationToken) {
      this.activeCancellationToken.cancel("Plugin unloading");
    }
  }

  async loadSettings(): Promise<void> {
    const stored = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Re-initialize infrastructure when settings change
    this.initializeInfrastructure();
  }

  /**
   * Initialize infrastructure based on settings
   */
  private initializeInfrastructure(): void {
    // Set log level
    const logLevelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
      none: LogLevel.NONE,
    };
    logger.setLogLevel(logLevelMap[this.settings.logLevel] || LogLevel.INFO);

    // Set locale
    setLocale(this.settings.uiLocale as SupportedLocale);

    // Configure rate limiter
    setRateLimitConfig(this.settings.rateLimitPerMinute, 60000);

    // Initialize context cache if enabled
    if (this.settings.enableContextCache) {
      if (!this.contextCache) {
        this.contextCache = new ContextCache(this.app, {
          ttlMs: 60000, // 1 minute cache
          maxEntries: 50,
          debounceMs: 500,
        });
      }
    } else if (this.contextCache) {
      this.contextCache.destroy();
      this.contextCache = null;
    }

    logger.debug("Plugin", "Infrastructure initialized", {
      logLevel: this.settings.logLevel,
      locale: this.settings.uiLocale,
      cacheEnabled: this.settings.enableContextCache,
      rateLimitPerMinute: this.settings.rateLimitPerMinute,
    });
  }

  /**
   * Create a new cancellation token for an operation
   */
  private createCancellationToken(): CancellationToken {
    // Cancel any previous operation
    if (this.activeCancellationToken) {
      this.activeCancellationToken.cancel("New operation started");
    }
    this.activeCancellationToken = new CancellationToken();
    return this.activeCancellationToken;
  }

  /**
   * Get user context (cached if enabled)
   */
  private getUserContext(): UserContext {
    if (this.contextCache && this.settings.enableContextCache) {
      const cacheKey = `${this.settings.goalsFolder}|${this.settings.projectsFolder}|${this.settings.epicsFolder}|${this.settings.tasksFolder}`;
      
      const goals = this.contextCache.getGoals(cacheKey, () =>
        loadUserContext(this.app, this.settings.goalsFolder, this.settings.projectsFolder, this.settings.epicsFolder, this.settings.tasksFolder).goals
      ) as UserContext["goals"];
      
      const projects = this.contextCache.getProjects(cacheKey, () =>
        loadUserContext(this.app, this.settings.goalsFolder, this.settings.projectsFolder, this.settings.epicsFolder, this.settings.tasksFolder).projects
      ) as UserContext["projects"];
      
      const epics = this.contextCache.getEpics(cacheKey, () =>
        loadUserContext(this.app, this.settings.goalsFolder, this.settings.projectsFolder, this.settings.epicsFolder, this.settings.tasksFolder).epics
      ) as UserContext["epics"];
      
      const activeTasks = this.contextCache.getTasks(cacheKey, () =>
        loadUserContext(this.app, this.settings.goalsFolder, this.settings.projectsFolder, this.settings.epicsFolder, this.settings.tasksFolder).activeTasks
      ) as UserContext["activeTasks"];

      return { goals, projects, epics, activeTasks };
    }

    return loadUserContext(
      this.app,
      this.settings.goalsFolder,
      this.settings.projectsFolder,
      this.settings.epicsFolder,
      this.settings.tasksFolder
    );
  }

  /**
   * Show quick task input modal
   */
  private showQuickTaskModal(): void {
    if (!this.settings.openAIApiKey) {
      showErrorNotice(t("errorNoApiKey"));
      return;
    }

    new QuickTaskModal(this.app, async (input: string) => {
      await this.processQuickTask(input);
    }).open();
  }

  /**
   * Process quick task input with GPT
   */
  private async processQuickTask(input: string): Promise<void> {
    showNotice(t("progressProcessing"));
    const cancellationToken = this.createCancellationToken();

    try {
      // Load user context (cached if enabled)
      const context = this.getUserContext();
      const formattedContext = formatContextForPrompt(context);

      // Build prompt
      const prompt = fillPromptTemplate(this.settings.taskCreationPrompt, {
        goals: formattedContext.goals,
        projects: formattedContext.projects,
        epics: formattedContext.epics,
        input: input,
      });

      // Call GPT with cancellation and timeout support
      const result = await callGptApi(
        prompt,
        "You are a helpful task management assistant that creates well-structured tasks.",
        this.settings.openAIApiKey,
        this.settings.gptModel,
        this.settings.gptMaxTokens,
        this.settings.gptTemperature,
        cancellationToken,
        this.settings.apiTimeoutSeconds,
        this.settings.apiMaxRetries
      );

      // Check if cancelled
      if (result.cancelled) {
        showNotice(t("taskCreationCancelled"));
        return;
      }

      if (!result.success || !result.content) {
        showErrorNotice(result.errorMessage || "Unknown error");
        return;
      }

      // Parse suggestion
      const suggestion = parseTaskSuggestion(result.content);

      if (!suggestion) {
        showNotice(t("errorParsingFailed"));
        await this.createSimpleTask(input);
        return;
      }

      // Show review modal
      new TaskReviewModal(
        this.app,
        suggestion,
        context.epics,
        async (finalSuggestion: TaskSuggestion, selectedEpic: string | null) => {
          await this.createTaskFromSuggestion(finalSuggestion, selectedEpic);
        },
        () => {
          showNotice(t("taskCreationCancelled"));
        }
      ).open();

    } catch (error) {
      logger.error("Plugin", "Quick task error", { error: error instanceof Error ? error.message : "Unknown" });
      showErrorNotice(error instanceof Error ? error.message : "Unknown error");
    }
  }

  /**
   * Create task from GPT suggestion with confirmation dialog
   */
  private async createTaskFromSuggestion(
    suggestion: TaskSuggestion,
    epicName: string | null
  ): Promise<void> {
    try {
      // Build summary for confirmation
      const summary = buildSuggestionSummary(suggestion, epicName, this.settings);
      
      // Show confirmation dialog
      const confirmed = await showTaskConfirmation(
        this.app,
        [summary],
        "single",
        epicName
      );

      if (!confirmed) {
        new Notice("Task creation cancelled");
        return;
      }

      let epicMetadata = null;

      if (epicName) {
        epicMetadata = await getEpicMetadata(this.app, epicName, this.settings.epicsFolder);
      }

      const content = generateTaskFromSuggestion(suggestion, epicMetadata, this.settings);
      const file = await createTaskFile(
        this.app,
        content,
        suggestion.title,
        epicName,
        this.settings
      );

      new Notice(`✅ Created task: ${suggestion.title}`);

      // Open the created file
      await this.app.workspace.openLinkText(file.path, "", false);

    } catch (error) {
      console.error("[GPT Task Manager] Task creation error:", error);
      new Notice(`Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Start voice task recording
   */
  private startVoiceTask(): void {
    if (!this.settings.openAIApiKey) {
      showErrorNotice(t("errorNoApiKey"));
      return;
    }

    if (!this.settings.enableVoiceInput) {
      showErrorNotice(t("errorVoiceDisabled"));
      return;
    }

    new VoiceRecordingModal(
      this.app,
      async (audioBlob: Blob) => {
        await this.processVoiceTask(audioBlob);
      },
      () => {
        showNotice(t("taskCreationCancelled"));
      }
    ).open();
  }

  /**
   * Process voice recording into task
   */
  private async processVoiceTask(audioBlob: Blob): Promise<void> {
    showNotice(t("progressTranscribing"));
    const cancellationToken = this.createCancellationToken();

    try {
      // Transcribe audio with cancellation support
      const transcription = await transcribeAudio(
        audioBlob,
        this.settings.openAIApiKey,
        this.settings.whisperModel,
        this.settings.defaultLanguage === "auto" ? undefined : this.settings.defaultLanguage,
        cancellationToken
      );

      if (!transcription) {
        showErrorNotice("Transcription returned empty result");
        return;
      }

      showNotice(`📝 Transcribed: "${transcription.substring(0, 50)}..."`);

      // Parse voice input for quick extraction
      const voiceInput = parseVoiceTaskInput(transcription);

      // If smart suggestions enabled, process with GPT
      if (this.settings.enableSmartSuggestions) {
        await this.processQuickTask(transcription);
      } else {
        // Create simple task from voice input
        await this.createSimpleTask(voiceInput.taskTitle || transcription);
      }

    } catch (error) {
      logger.error("Plugin", "Voice task error", { error: error instanceof Error ? error.message : "Unknown" });
      
      // Check if it was a cancellation
      if (error instanceof Error && error.message.includes("cancelled")) {
        showNotice(t("taskCreationCancelled"));
      } else {
        showErrorNotice(error instanceof Error ? error.message : "Unknown error");
      }
    }
  }

  /**
   * Show epic breakdown modal
   */
  private showEpicBreakdownModal(): void {
    if (!this.settings.openAIApiKey) {
      showErrorNotice(t("errorNoApiKey"));
      return;
    }

    const epics = loadEpics(this.app, this.settings.epicsFolder);

    if (epics.length === 0) {
      showErrorNotice(t("errorNoEpics"));
      return;
    }

    new EpicSelectModal(this.app, epics, async (epic: EpicContext) => {
      await this.breakdownEpic(epic);
    }).open();
  }

  /**
   * Break down an epic into tasks using GPT
   */
  private async breakdownEpic(epic: EpicContext): Promise<void> {
    showNotice(t("breakdownCreating", { epic: epic.name }));
    const cancellationToken = this.createCancellationToken();

    try {
      // Read epic content for more context
      const epicPath = epic.path;
      const epicFile = this.app.vault.getAbstractFileByPath(epicPath);
      let epicContent = "";

      if (epicFile instanceof TFile) {
        epicContent = await this.app.vault.read(epicFile);
      }

      // Extract objective from content if available
      const objectiveMatch = epicContent.match(/## 🎯 Objective[\s\S]*?> What this epic aims to achieve:\s*\n-\s*(.+)/);
      const objective = objectiveMatch ? objectiveMatch[1] : epic.description || "";

      // Build prompt
      const prompt = fillPromptTemplate(this.settings.taskBreakdownPrompt, {
        title: epic.name,
        description: epic.description || "No description provided",
        objective: objective,
        goal: epic.goal,
        project: epic.project,
        area: epic.area,
      });

      // Call GPT with cancellation and timeout support
      const result = await callGptApi(
        prompt,
        "You are an expert project manager that breaks down complex work into actionable tasks.",
        this.settings.openAIApiKey,
        this.settings.gptModel,
        this.settings.gptMaxTokens,
        this.settings.gptTemperature,
        cancellationToken,
        this.settings.apiTimeoutSeconds,
        this.settings.apiMaxRetries
      );

      // Check if cancelled
      if (result.cancelled) {
        showNotice(t("taskCreationCancelled"));
        return;
      }

      if (!result.success || !result.content) {
        showErrorNotice(result.errorMessage || "Unknown error");
        return;
      }

      // Parse breakdown
      const breakdown = parseTaskBreakdown(result.content);

      if (!breakdown || breakdown.tasks.length === 0) {
        showErrorNotice("Failed to parse task breakdown from GPT response.");
        return;
      }

      // Show review modal
      new BreakdownReviewModal(
        this.app,
        breakdown,
        epic.name,
        async (finalBreakdown: TaskBreakdown) => {
          await this.createBreakdownTasks(finalBreakdown, epic);
        },
        () => {
          showNotice(t("taskCreationCancelled"));
        }
      ).open();

    } catch (error) {
      logger.error("Plugin", "Epic breakdown error", { error: error instanceof Error ? error.message : "Unknown" });
      showErrorNotice(error instanceof Error ? error.message : "Unknown error");
    }
  }

  /**
   * Create tasks from breakdown with confirmation dialog
   */
  private async createBreakdownTasks(
    breakdown: TaskBreakdown,
    epic: EpicContext
  ): Promise<void> {
    try {
      // Build summaries for confirmation (if enabled)
      if (this.settings.showConfirmationDialogs) {
        const summaries = buildBreakdownSummaries(breakdown, epic.name, this.settings);
        
        const confirmed = await showTaskConfirmation(
          this.app,
          summaries,
          "breakdown",
          epic.name
        );

        if (!confirmed) {
          showNotice(t("taskCreationCancelled"));
          return;
        }
      }

      const epicMetadata = {
        area: epic.area,
        goal: epic.goal,
        project: epic.project,
      };

      const files = await createTasksFromBreakdown(
        this.app,
        breakdown,
        epic.name,
        epicMetadata,
        this.settings
      );

      showSuccessNotice(t("taskCreated", { title: `${files.length} tasks for ${epic.name}` }));

      // Open the first task
      if (files.length > 0) {
        await this.app.workspace.openLinkText(files[0].path, "", false);
      }

    } catch (error) {
      logger.error("Plugin", "Breakdown task creation error", { error: error instanceof Error ? error.message : "Unknown" });
      showErrorNotice(error instanceof Error ? error.message : "Unknown error");
    }
  }

  /**
   * Show simple task creation modal (no AI)
   */
  private showSimpleTaskModal(): void {
    new QuickTaskModal(this.app, async (input: string) => {
      await this.createSimpleTask(input);
    }).open();
  }

  /**
   * Create a simple task without GPT (with confirmation)
   */
  private async createSimpleTask(title: string): Promise<void> {
    try {
      // Build summary for confirmation
      const summary: TaskCreationSummary = {
        title: title,
        targetFolder: this.settings.tasksFolder,
        epic: null,
        priority: this.settings.defaultPriority,
        dependsOnTask: null,
      };

      // Show confirmation dialog
      const confirmed = await showTaskConfirmation(
        this.app,
        [summary],
        "single",
        null
      );

      if (!confirmed) {
        new Notice("Task creation cancelled");
        return;
      }

      const params: CreateTaskParams = {
        title: title,
        objective: "",
        importance: "",
        status: this.settings.defaultStatus,
        priority: this.settings.defaultPriority,
        tags: ["tasks"],
      };

      const content = generateTaskContent(params, this.settings);
      const file = await createTaskFile(
        this.app,
        content,
        title,
        null,
        this.settings
      );

      new Notice(`✅ Created task: ${title}`);
      await this.app.workspace.openLinkText(file.path, "", false);

    } catch (error) {
      console.error("[GPT Task Manager] Simple task error:", error);
      new Notice(`Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Create task from selected text
   */
  private async createTaskFromSelection(editor: Editor): Promise<void> {
    const selection = editor.getSelection();

    if (!selection) {
      new Notice("Please select some text first");
      return;
    }

    if (this.settings.enableSmartSuggestions && this.settings.openAIApiKey) {
      await this.processQuickTask(selection);
    } else {
      await this.createSimpleTask(selection);
    }
  }
}

