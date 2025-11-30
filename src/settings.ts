import {
  App,
  PluginSettingTab,
  Setting,
  TextComponent,
  TextAreaComponent,
  ToggleComponent,
  DropdownComponent,
  ButtonComponent,
  normalizePath,
} from "obsidian";
import type GptTaskManagerPlugin from "../main";

export interface GptTaskManagerSettings {
  // API Configuration
  openAIApiKey: string;
  gptModel: string;
  whisperModel: string;
  gptMaxTokens: number;
  gptTemperature: number;

  // API Reliability
  apiTimeoutSeconds: number;
  apiMaxRetries: number;
  rateLimitPerMinute: number;

  // Vault Paths
  tasksFolder: string;
  epicsFolder: string;
  goalsFolder: string;
  projectsFolder: string;
  milestonesFolder: string;
  templatesFolder: string;

  // Template Files
  taskTemplatePath: string;
  epicTemplatePath: string;

  // Features
  enableVoiceInput: boolean;
  enableSmartSuggestions: boolean;
  enableAutoBreakdown: boolean;
  enableContextCache: boolean;
  showConfirmationDialogs: boolean;
  defaultLanguage: string;

  // UI/Locale
  uiLocale: string;

  // Task Creation Defaults
  defaultStatus: string;
  defaultPriority: string;

  // Logging
  logLevel: string;
  enableDebugNotices: boolean;

  // GPT Prompts (customizable)
  taskCreationPrompt: string;
  taskBreakdownPrompt: string;
  prioritizationPrompt: string;
}

export const DEFAULT_SETTINGS: GptTaskManagerSettings = {
  openAIApiKey: "",
  gptModel: "gpt-4o-mini",
  whisperModel: "whisper-1",
  gptMaxTokens: 2000,
  gptTemperature: 0.7,

  // API Reliability defaults
  apiTimeoutSeconds: 60,
  apiMaxRetries: 3,
  rateLimitPerMinute: 10,

  tasksFolder: "500 Plan & Reflect/520 Tasks",
  epicsFolder: "500 Plan & Reflect/510 Epics",
  goalsFolder: "300 Goals & Milestone/Goals",
  projectsFolder: "400 Projects",
  milestonesFolder: "300 Goals & Milestone/Milestones",
  templatesFolder: "900 Templates",

  taskTemplatePath: "900 Templates/4 Task Template.md",
  epicTemplatePath: "900 Templates/4 Epic Template.md",

  enableVoiceInput: true,
  enableSmartSuggestions: true,
  enableAutoBreakdown: true,
  enableContextCache: true,
  showConfirmationDialogs: true,
  defaultLanguage: "ko",

  // UI/Locale
  uiLocale: "en",

  // Logging
  logLevel: "info",
  enableDebugNotices: false,

  defaultStatus: "backlog",
  defaultPriority: "medium",

  taskCreationPrompt: `You are an expert task manager assistant. Based on the user's input and their current goals/projects context, help create well-structured tasks.

USER CONTEXT:
Goals: {{goals}}
Projects: {{projects}}
Current Epics: {{epics}}

USER INPUT: {{input}}

Create a task with:
1. A clear, actionable title
2. Specific objectives (what needs to be accomplished)
3. Why it matters (connection to goals)
4. Suggested Epic/Project association
5. Priority recommendation (low/medium/high/critical)
6. Estimated complexity (simple/moderate/complex)

Respond in JSON format:
{
  "title": "Task title",
  "objective": "What needs to be accomplished",
  "importance": "Why it matters",
  "suggestedEpic": "Epic name or null",
  "suggestedProject": "Project name or null",
  "priority": "medium",
  "complexity": "moderate",
  "subtasks": ["subtask 1", "subtask 2"] // if complex
}`,

  taskBreakdownPrompt: `You are an expert project manager. Break down the following epic/task into smaller, actionable tasks.

EPIC/TASK: {{title}}
DESCRIPTION: {{description}}
OBJECTIVE: {{objective}}

Context:
- Goal: {{goal}}
- Project: {{project}}
- Area: {{area}}

Create 3-8 well-structured subtasks that:
1. Are specific and actionable
2. Can be completed in 1-4 hours each
3. Have clear dependencies (if any)
4. Lead to completing the parent task/epic

Respond in JSON format:
{
  "tasks": [
    {
      "title": "Task title",
      "objective": "What this task accomplishes",
      "priority": "medium",
      "dependsOn": null // or task index
    }
  ]
}`,

  prioritizationPrompt: `You are a productivity expert. Analyze the following tasks and suggest optimal prioritization.

TASKS:
{{tasks}}

USER'S CURRENT FOCUS:
- Active Goals: {{goals}}
- Deadlines: {{deadlines}}
- Available Time: {{availableTime}}

Provide prioritization recommendations considering:
1. Urgency and deadlines
2. Alignment with current goals
3. Dependencies between tasks
4. Effort vs impact ratio

Respond in JSON format:
{
  "prioritizedTasks": [
    {
      "title": "Task title",
      "suggestedPriority": "high",
      "reasoning": "Why this priority",
      "suggestedOrder": 1
    }
  ],
  "insights": "Overall productivity insights"
}`,
};

export class GptTaskManagerSettingTab extends PluginSettingTab {
  plugin: GptTaskManagerPlugin;

  constructor(app: App, plugin: GptTaskManagerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("gpt-task-manager-settings");

    containerEl.createEl("h1", { text: "GPT Task Manager Settings" });

    // API Configuration Section
    containerEl.createEl("h2", { text: "🔑 API Configuration" });

    new Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("Your OpenAI API key for GPT and Whisper.")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openAIApiKey)
          .onChange(async (value: string) => {
            this.plugin.settings.openAIApiKey = value;
            await this.plugin.saveSettings();
          })
      )
      .then((setting: Setting) => {
        const inputEl = setting.controlEl.querySelector("input");
        if (inputEl) {
          inputEl.type = "password";
          inputEl.style.width = "300px";
        }
      });

    new Setting(containerEl)
      .setName("GPT Model")
      .setDesc("The OpenAI model to use for task assistance (gpt-4o-mini, gpt-4o, gpt-4-turbo).")
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("gpt-4o-mini", "GPT-4o Mini (Fast, Cheap)")
          .addOption("gpt-4o", "GPT-4o (Powerful)")
          .addOption("gpt-4-turbo", "GPT-4 Turbo")
          .addOption("gpt-3.5-turbo", "GPT-3.5 Turbo (Legacy)")
          .setValue(this.plugin.settings.gptModel)
          .onChange(async (value: string) => {
            this.plugin.settings.gptModel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("GPT Max Tokens")
      .setDesc("Maximum tokens for GPT responses (500-4000).")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("2000")
          .setValue(String(this.plugin.settings.gptMaxTokens))
          .onChange(async (value: string) => {
            const parsed = parseInt(value, 10);
            this.plugin.settings.gptMaxTokens = isNaN(parsed) ? 2000 : Math.max(500, Math.min(4000, parsed));
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("GPT Temperature")
      .setDesc("Creativity level (0.0-1.0). Lower = more focused, Higher = more creative.")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("0.7")
          .setValue(String(this.plugin.settings.gptTemperature))
          .onChange(async (value: string) => {
            const parsed = parseFloat(value);
            this.plugin.settings.gptTemperature = isNaN(parsed) ? 0.7 : Math.max(0, Math.min(1, parsed));
            await this.plugin.saveSettings();
          })
      );

    // API Reliability Section
    containerEl.createEl("h2", { text: "🔄 API Reliability" });

    new Setting(containerEl)
      .setName("Request Timeout")
      .setDesc("Timeout for API requests in seconds (10-120).")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("60")
          .setValue(String(this.plugin.settings.apiTimeoutSeconds))
          .onChange(async (value: string) => {
            const parsed = parseInt(value, 10);
            this.plugin.settings.apiTimeoutSeconds = isNaN(parsed) ? 60 : Math.max(10, Math.min(120, parsed));
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max Retries")
      .setDesc("Maximum retry attempts for failed requests (0-5).")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("3")
          .setValue(String(this.plugin.settings.apiMaxRetries))
          .onChange(async (value: string) => {
            const parsed = parseInt(value, 10);
            this.plugin.settings.apiMaxRetries = isNaN(parsed) ? 3 : Math.max(0, Math.min(5, parsed));
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Rate Limit (per minute)")
      .setDesc("Maximum API requests per minute to prevent abuse (5-30).")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("10")
          .setValue(String(this.plugin.settings.rateLimitPerMinute))
          .onChange(async (value: string) => {
            const parsed = parseInt(value, 10);
            this.plugin.settings.rateLimitPerMinute = isNaN(parsed) ? 10 : Math.max(5, Math.min(30, parsed));
            await this.plugin.saveSettings();
          })
      );

    // Vault Paths Section
    containerEl.createEl("h2", { text: "📁 Vault Paths" });

    new Setting(containerEl)
      .setName("Tasks Folder")
      .setDesc("Path to your tasks folder (e.g., 500 Plan & Reflect/520 Tasks).")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("500 Plan & Reflect/520 Tasks")
          .setValue(this.plugin.settings.tasksFolder)
          .onChange(async (value: string) => {
            this.plugin.settings.tasksFolder = normalizePath(value.trim());
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Epics Folder")
      .setDesc("Path to your epics folder.")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("500 Plan & Reflect/510 Epics")
          .setValue(this.plugin.settings.epicsFolder)
          .onChange(async (value: string) => {
            this.plugin.settings.epicsFolder = normalizePath(value.trim());
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Goals Folder")
      .setDesc("Path to your goals folder.")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("300 Goals & Milestone/Goals")
          .setValue(this.plugin.settings.goalsFolder)
          .onChange(async (value: string) => {
            this.plugin.settings.goalsFolder = normalizePath(value.trim());
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Projects Folder")
      .setDesc("Path to your projects folder.")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("400 Projects")
          .setValue(this.plugin.settings.projectsFolder)
          .onChange(async (value: string) => {
            this.plugin.settings.projectsFolder = normalizePath(value.trim());
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Task Template Path")
      .setDesc("Path to your task template file.")
      .addText((text: TextComponent) =>
        text
          .setPlaceholder("900 Templates/4 Task Template.md")
          .setValue(this.plugin.settings.taskTemplatePath)
          .onChange(async (value: string) => {
            this.plugin.settings.taskTemplatePath = normalizePath(value.trim());
            await this.plugin.saveSettings();
          })
      );

    // Features Section
    containerEl.createEl("h2", { text: "⚡ Features" });

    new Setting(containerEl)
      .setName("Enable Voice Input")
      .setDesc("Allow creating tasks via voice recording (requires microphone access).")
      .addToggle((toggle: ToggleComponent) =>
        toggle
          .setValue(this.plugin.settings.enableVoiceInput)
          .onChange(async (value: boolean) => {
            this.plugin.settings.enableVoiceInput = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable Smart Suggestions")
      .setDesc("Use GPT to suggest task details based on your goals and context.")
      .addToggle((toggle: ToggleComponent) =>
        toggle
          .setValue(this.plugin.settings.enableSmartSuggestions)
          .onChange(async (value: boolean) => {
            this.plugin.settings.enableSmartSuggestions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable Auto Breakdown")
      .setDesc("Automatically suggest breaking down complex tasks into subtasks.")
      .addToggle((toggle: ToggleComponent) =>
        toggle
          .setValue(this.plugin.settings.enableAutoBreakdown)
          .onChange(async (value: boolean) => {
            this.plugin.settings.enableAutoBreakdown = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default Language")
      .setDesc("Default language for voice transcription and GPT responses.")
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("ko", "한국어 (Korean)")
          .addOption("en", "English")
          .addOption("auto", "Auto-detect")
          .setValue(this.plugin.settings.defaultLanguage)
          .onChange(async (value: string) => {
            this.plugin.settings.defaultLanguage = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("UI Language")
      .setDesc("Language for plugin interface elements.")
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("en", "English")
          .addOption("ko", "한국어 (Korean)")
          .addOption("ja", "日本語 (Japanese)")
          .addOption("zh", "中文 (Chinese)")
          .setValue(this.plugin.settings.uiLocale)
          .onChange(async (value: string) => {
            this.plugin.settings.uiLocale = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable Context Cache")
      .setDesc("Cache vault context (goals, projects, epics) for faster performance.")
      .addToggle((toggle: ToggleComponent) =>
        toggle
          .setValue(this.plugin.settings.enableContextCache)
          .onChange(async (value: boolean) => {
            this.plugin.settings.enableContextCache = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Confirmation Dialogs")
      .setDesc("Show confirmation before creating tasks.")
      .addToggle((toggle: ToggleComponent) =>
        toggle
          .setValue(this.plugin.settings.showConfirmationDialogs)
          .onChange(async (value: boolean) => {
            this.plugin.settings.showConfirmationDialogs = value;
            await this.plugin.saveSettings();
          })
      );

    // Logging Section
    containerEl.createEl("h2", { text: "🔍 Logging & Debugging" });

    new Setting(containerEl)
      .setName("Log Level")
      .setDesc("Minimum log level for console output.")
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("debug", "Debug (Verbose)")
          .addOption("info", "Info (Normal)")
          .addOption("warn", "Warnings Only")
          .addOption("error", "Errors Only")
          .addOption("none", "Disabled")
          .setValue(this.plugin.settings.logLevel)
          .onChange(async (value: string) => {
            this.plugin.settings.logLevel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show Debug Notices")
      .setDesc("Show debug information in Obsidian notices (useful for troubleshooting).")
      .addToggle((toggle: ToggleComponent) =>
        toggle
          .setValue(this.plugin.settings.enableDebugNotices)
          .onChange(async (value: boolean) => {
            this.plugin.settings.enableDebugNotices = value;
            await this.plugin.saveSettings();
          })
      );

    // Defaults Section
    containerEl.createEl("h2", { text: "📋 Task Defaults" });

    new Setting(containerEl)
      .setName("Default Status")
      .setDesc("Default status for new tasks.")
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("backlog", "Backlog")
          .addOption("todo", "To Do")
          .addOption("in-progress", "In Progress")
          .setValue(this.plugin.settings.defaultStatus)
          .onChange(async (value: string) => {
            this.plugin.settings.defaultStatus = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default Priority")
      .setDesc("Default priority for new tasks.")
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("low", "Low")
          .addOption("medium", "Medium")
          .addOption("high", "High")
          .addOption("critical", "Critical")
          .setValue(this.plugin.settings.defaultPriority)
          .onChange(async (value: string) => {
            this.plugin.settings.defaultPriority = value;
            await this.plugin.saveSettings();
          })
      );

    // Prompts Section
    containerEl.createEl("h2", { text: "🤖 GPT Prompts" });
    containerEl.createEl("p", { 
      text: "Customize the prompts used for GPT-powered features. Use {{placeholders}} for dynamic content.",
      cls: "setting-item-description"
    });

    new Setting(containerEl)
      .setName("Task Creation Prompt")
      .setDesc("Prompt used when creating new tasks with GPT assistance.")
      .addTextArea((text: TextAreaComponent) => {
        text
          .setPlaceholder("Enter your task creation prompt...")
          .setValue(this.plugin.settings.taskCreationPrompt)
          .onChange(async (value: string) => {
            this.plugin.settings.taskCreationPrompt = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 10;
        text.inputEl.style.width = "100%";
        text.inputEl.style.fontFamily = "monospace";
        text.inputEl.style.fontSize = "12px";
      });

    new Setting(containerEl)
      .setName("Task Breakdown Prompt")
      .setDesc("Prompt used when breaking down tasks/epics into subtasks.")
      .addTextArea((text: TextAreaComponent) => {
        text
          .setPlaceholder("Enter your task breakdown prompt...")
          .setValue(this.plugin.settings.taskBreakdownPrompt)
          .onChange(async (value: string) => {
            this.plugin.settings.taskBreakdownPrompt = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 10;
        text.inputEl.style.width = "100%";
        text.inputEl.style.fontFamily = "monospace";
        text.inputEl.style.fontSize = "12px";
      });

    // Reset Section
    containerEl.createEl("h2", { text: "🔄 Reset" });

    new Setting(containerEl)
      .setName("Reset to Defaults")
      .setDesc("Reset all settings to their default values.")
      .addButton((button: ButtonComponent) =>
        button
          .setButtonText("Reset All Settings")
          .setWarning()
          .onClick(async () => {
            const apiKey = this.plugin.settings.openAIApiKey; // Preserve API key
            this.plugin.settings = { ...DEFAULT_SETTINGS, openAIApiKey: apiKey };
            await this.plugin.saveSettings();
            this.display();
          })
      );
  }
}

