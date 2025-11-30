/**
 * Enhanced UI components with loading states, cancel buttons, and accessibility
 */

import { App, Modal, Notice } from "obsidian";
import { CancellationToken } from "./api-client";
import { t } from "./i18n";

/**
 * Loading state for operations
 */
export interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number;
  canCancel: boolean;
}

/**
 * Base modal with enhanced accessibility and loading support
 */
export abstract class EnhancedModal extends Modal {
  protected loadingState: LoadingState = {
    isLoading: false,
    message: "",
    canCancel: false,
  };
  protected cancellationToken: CancellationToken | null = null;
  protected loadingOverlay: HTMLElement | null = null;

  constructor(app: App) {
    super(app);
  }

  /**
   * Show loading overlay with optional cancel button
   */
  protected showLoading(message: string, canCancel: boolean = true): CancellationToken {
    this.loadingState = {
      isLoading: true,
      message,
      canCancel,
    };

    // Create cancellation token
    this.cancellationToken = new CancellationToken();

    // Create or update loading overlay
    if (!this.loadingOverlay) {
      this.loadingOverlay = this.contentEl.createDiv({ cls: "loading-overlay" });
    }
    
    this.loadingOverlay.empty();
    this.loadingOverlay.style.display = "flex";

    // Loading spinner
    const spinner = this.loadingOverlay.createDiv({ cls: "loading-spinner" });
    spinner.setAttribute("role", "status");
    spinner.setAttribute("aria-label", t("ariaLoadingIndicator"));

    // Loading message
    const messageEl = this.loadingOverlay.createEl("p", { 
      text: message,
      cls: "loading-message"
    });
    messageEl.setAttribute("aria-live", "polite");

    // Cancel button (if allowed)
    if (canCancel) {
      const cancelBtn = this.loadingOverlay.createEl("button", {
        text: t("cancel"),
        cls: "loading-cancel-btn"
      });
      cancelBtn.setAttribute("aria-label", t("ariaCancelButton"));
      cancelBtn.onclick = (): void => {
        this.cancelOperation();
      };
    }

    return this.cancellationToken;
  }

  /**
   * Hide loading overlay
   */
  protected hideLoading(): void {
    this.loadingState.isLoading = false;
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = "none";
    }
  }

  /**
   * Update loading message
   */
  protected updateLoadingMessage(message: string): void {
    if (this.loadingOverlay) {
      const messageEl = this.loadingOverlay.querySelector(".loading-message");
      if (messageEl) {
        messageEl.textContent = message;
      }
    }
  }

  /**
   * Cancel the current operation
   */
  protected cancelOperation(): void {
    if (this.cancellationToken) {
      this.cancellationToken.cancel(t("taskCreationCancelled"));
    }
    this.hideLoading();
  }

  /**
   * Add ARIA attributes to modal
   */
  protected setupAccessibility(title: string): void {
    this.modalEl.setAttribute("role", "dialog");
    this.modalEl.setAttribute("aria-modal", "true");
    this.modalEl.setAttribute("aria-labelledby", "modal-title");
    
    // Create visually hidden title for screen readers if not visible
    const titleEl = this.contentEl.querySelector("h2");
    if (titleEl) {
      titleEl.id = "modal-title";
    }
  }

  /**
   * Create accessible button
   */
  protected createAccessibleButton(
    parent: HTMLElement,
    text: string,
    ariaLabel: string,
    onClick: () => void,
    classes?: string
  ): HTMLButtonElement {
    const btn = parent.createEl("button", { text, cls: classes });
    btn.setAttribute("aria-label", ariaLabel);
    btn.onclick = onClick;
    return btn;
  }

  onClose(): void {
    // Cancel any pending operation
    if (this.cancellationToken && !this.cancellationToken.isCancelled) {
      this.cancellationToken.cancel("Modal closed");
    }
    super.onClose();
  }
}

/**
 * Progress modal for long-running operations
 */
export class ProgressModal extends EnhancedModal {
  private progressCallback: (() => void) | null = null;
  private progressBar: HTMLElement | null = null;
  private currentProgress: number = 0;

  constructor(
    app: App,
    private title: string,
    private onCancel?: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-progress-modal");

    // Title
    contentEl.createEl("h2", { text: this.title });

    // Progress container
    const progressContainer = contentEl.createDiv({ cls: "progress-container" });
    progressContainer.setAttribute("role", "progressbar");
    progressContainer.setAttribute("aria-valuemin", "0");
    progressContainer.setAttribute("aria-valuemax", "100");
    progressContainer.setAttribute("aria-valuenow", "0");

    this.progressBar = progressContainer.createDiv({ cls: "progress-bar" });
    this.progressBar.style.width = "0%";

    // Message
    const messageEl = contentEl.createEl("p", { 
      text: t("loading"),
      cls: "progress-message"
    });
    messageEl.setAttribute("aria-live", "polite");

    // Cancel button
    const buttonsEl = contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = this.createAccessibleButton(
      buttonsEl,
      t("cancel"),
      t("ariaCancelButton"),
      () => {
        if (this.onCancel) {
          this.onCancel();
        }
        this.close();
      }
    );

    this.setupAccessibility(this.title);
  }

  /**
   * Update progress
   */
  updateProgress(progress: number, message?: string): void {
    this.currentProgress = Math.min(100, Math.max(0, progress));
    
    if (this.progressBar) {
      this.progressBar.style.width = `${this.currentProgress}%`;
      const container = this.progressBar.parentElement;
      if (container) {
        container.setAttribute("aria-valuenow", String(this.currentProgress));
      }
    }

    if (message) {
      const messageEl = this.contentEl.querySelector(".progress-message");
      if (messageEl) {
        messageEl.textContent = message;
      }
    }
  }

  /**
   * Get cancellation token
   */
  getCancellationToken(): CancellationToken {
    if (!this.cancellationToken) {
      this.cancellationToken = new CancellationToken();
    }
    return this.cancellationToken;
  }
}

/**
 * Conflict resolution modal
 */
export type ConflictResolution = "rename" | "overwrite" | "skip";

export class ConflictModal extends EnhancedModal {
  private resolve: ((value: ConflictResolution) => void) | null = null;

  constructor(
    app: App,
    private filename: string,
    private allowOverwrite: boolean = false
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-conflict-modal");

    // Title
    contentEl.createEl("h2", { text: "⚠️ File Conflict" });

    // Message
    contentEl.createEl("p", { 
      text: t("conflictFileExists", { filename: this.filename }),
      cls: "conflict-message"
    });

    // Options
    const optionsEl = contentEl.createDiv({ cls: "conflict-options" });

    // Rename button
    this.createAccessibleButton(
      optionsEl,
      t("conflictRename"),
      "Rename the file with a unique suffix",
      () => this.selectOption("rename"),
      "mod-cta"
    );

    // Overwrite button (if allowed)
    if (this.allowOverwrite) {
      this.createAccessibleButton(
        optionsEl,
        t("conflictOverwrite"),
        "Overwrite the existing file",
        () => this.selectOption("overwrite"),
        "mod-warning"
      );
    }

    // Skip button
    this.createAccessibleButton(
      optionsEl,
      t("conflictSkip"),
      "Skip creating this file",
      () => this.selectOption("skip")
    );

    this.setupAccessibility("File Conflict");
  }

  private selectOption(option: ConflictResolution): void {
    if (this.resolve) {
      this.resolve(option);
    }
    this.close();
  }

  /**
   * Show modal and wait for user selection
   */
  async waitForSelection(): Promise<ConflictResolution> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  onClose(): void {
    // Default to skip if closed without selection
    if (this.resolve) {
      this.resolve("skip");
    }
    super.onClose();
  }
}

/**
 * Batch creation confirmation modal
 */
export interface BatchItem {
  title: string;
  selected: boolean;
  deferred: boolean;
}

export class BatchConfirmationModal extends EnhancedModal {
  private items: BatchItem[];
  private onConfirm: ((items: BatchItem[]) => void) | null = null;

  constructor(
    app: App,
    items: { title: string }[],
    private epicName: string | null
  ) {
    super(app);
    this.items = items.map(item => ({
      title: item.title,
      selected: true,
      deferred: false,
    }));
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-batch-modal");

    // Title
    const titleText = `📋 ${t("confirmTaskCreation", { count: this.items.length })}`;
    contentEl.createEl("h2", { text: titleText });

    // Instructions
    contentEl.createEl("p", {
      text: "Select tasks to create now. Unselected tasks can be deferred for later.",
      cls: "modal-description"
    });

    // Task list with checkboxes
    const listEl = contentEl.createDiv({ cls: "batch-task-list" });
    listEl.setAttribute("role", "list");
    listEl.setAttribute("aria-label", t("ariaTaskList"));

    this.items.forEach((item, index) => {
      const itemEl = listEl.createDiv({ cls: "batch-task-item" });
      itemEl.setAttribute("role", "listitem");

      // Checkbox for selection
      const checkbox = itemEl.createEl("input", { type: "checkbox" });
      checkbox.checked = item.selected;
      checkbox.id = `task-${index}`;
      checkbox.setAttribute("aria-label", `Select ${item.title}`);
      checkbox.onchange = (): void => {
        item.selected = checkbox.checked;
        this.updateCounts();
      };

      // Label
      const label = itemEl.createEl("label");
      label.htmlFor = `task-${index}`;
      label.textContent = item.title;

      // Defer checkbox
      const deferContainer = itemEl.createDiv({ cls: "defer-container" });
      const deferCheckbox = deferContainer.createEl("input", { type: "checkbox" });
      deferCheckbox.id = `defer-${index}`;
      deferCheckbox.checked = item.deferred;
      deferCheckbox.setAttribute("aria-label", `Defer ${item.title}`);
      deferCheckbox.onchange = (): void => {
        item.deferred = deferCheckbox.checked;
        if (item.deferred) {
          item.selected = false;
          checkbox.checked = false;
        }
        this.updateCounts();
      };
      deferContainer.createEl("label", { text: "Defer" }).htmlFor = `defer-${index}`;
    });

    // Summary
    const summaryEl = contentEl.createDiv({ cls: "batch-summary" });
    summaryEl.id = "batch-summary";

    // Buttons
    const buttonsEl = contentEl.createDiv({ cls: "modal-button-container" });

    // Select all / none
    const selectAllBtn = this.createAccessibleButton(
      buttonsEl,
      "Select All",
      "Select all tasks",
      () => this.selectAll(true)
    );

    const selectNoneBtn = this.createAccessibleButton(
      buttonsEl,
      "Select None",
      "Deselect all tasks",
      () => this.selectAll(false)
    );

    // Cancel
    this.createAccessibleButton(
      buttonsEl,
      t("cancel"),
      t("ariaCancelButton"),
      () => this.close()
    );

    // Confirm
    this.createAccessibleButton(
      buttonsEl,
      t("confirmCreateTask"),
      t("ariaConfirmButton"),
      () => this.confirm(),
      "mod-cta"
    );

    this.updateCounts();
    this.setupAccessibility(titleText);
  }

  private updateCounts(): void {
    const selected = this.items.filter(item => item.selected).length;
    const deferred = this.items.filter(item => item.deferred).length;
    const summary = this.contentEl.querySelector("#batch-summary");
    if (summary) {
      summary.textContent = `${selected} to create now, ${deferred} deferred`;
    }
  }

  private selectAll(selected: boolean): void {
    this.items.forEach(item => {
      item.selected = selected;
      item.deferred = !selected;
    });
    
    // Update checkboxes
    const checkboxes = this.contentEl.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
      const el = checkbox as HTMLInputElement;
      if (el.id.startsWith("task-")) {
        el.checked = selected;
      } else if (el.id.startsWith("defer-")) {
        el.checked = !selected;
      }
    });
    
    this.updateCounts();
  }

  private confirm(): void {
    if (this.onConfirm) {
      this.onConfirm(this.items);
    }
    this.close();
  }

  /**
   * Show modal and wait for confirmation
   */
  async waitForConfirmation(): Promise<BatchItem[]> {
    return new Promise((resolve) => {
      this.onConfirm = resolve;
      this.open();
    });
  }

  onClose(): void {
    if (this.onConfirm) {
      // Return only selected items that aren't deferred
      this.onConfirm(this.items.filter(item => item.selected && !item.deferred));
    }
    super.onClose();
  }
}

/**
 * Show a notice with appropriate styling
 */
export function showNotice(message: string, duration: number = 4000): void {
  new Notice(message, duration);
}

/**
 * Show error notice with recovery suggestion
 */
export function showErrorNotice(error: string, recovery?: string): void {
  const message = recovery ? `${error}\n${recovery}` : error;
  new Notice(message, 6000);
}

/**
 * Show success notice
 */
export function showSuccessNotice(message: string): void {
  new Notice(`✅ ${message}`, 3000);
}

