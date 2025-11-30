import { Modal, App, Notice } from "obsidian";
import { callWhisperApi, CancellationToken } from "./api-client";
import { logger } from "./logger";

const CATEGORY = "Voice";

/**
 * Result from voice transcription parsing
 */
export interface VoiceTaskInput {
  rawText: string;
  taskTitle: string;
  description: string;
  epic: string;
  project: string;
  priority: string;
}

/**
 * Result from transcription
 */
export interface TranscriptionResult {
  success: boolean;
  text: string | null;
  error: string | null;
  cancelled: boolean;
}

/**
 * Recording Modal for voice input
 */
export class VoiceRecordingModal extends Modal {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timerInterval: number | null = null;
  private startTime: number = 0;
  private timerEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private startBtn: HTMLButtonElement | null = null;
  private stopBtn: HTMLButtonElement | null = null;
  private recordingDot: HTMLElement | null = null;
  private onComplete: (blob: Blob) => Promise<void>;
  private onCancel: () => void;

  constructor(
    app: App,
    onComplete: (blob: Blob) => Promise<void>,
    onCancel: () => void
  ) {
    super(app);
    this.onComplete = onComplete;
    this.onCancel = onCancel;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gpt-task-manager-recording-modal");

    // Title
    contentEl.createEl("h3", { text: "🎤 Voice Task Capture" });

    // Recording indicator
    const indicatorEl = contentEl.createDiv({ cls: "recording-indicator" });
    this.recordingDot = indicatorEl.createDiv({ cls: "recording-dot" });
    this.statusEl = indicatorEl.createSpan({ text: "Ready to record" });

    // Timer
    this.timerEl = contentEl.createDiv({ cls: "recording-timer", text: "00:00" });

    // Instructions
    const instructionsEl = contentEl.createDiv({ cls: "recording-instructions" });
    instructionsEl.createEl("p", { text: "Speak your task naturally. Examples:" });
    const examplesList = instructionsEl.createEl("ul");
    examplesList.createEl("li", { text: '"Create login page for the app"' });
    examplesList.createEl("li", { text: '"High priority: Fix payment bug by Friday"' });
    examplesList.createEl("li", { text: '"Add user profile settings to Freedom Runway project"' });

    // Buttons
    const buttonsEl = contentEl.createDiv({ cls: "recording-buttons" });

    this.startBtn = buttonsEl.createEl("button", {
      text: "🎙️ Start Recording",
      cls: "mod-cta",
    });
    this.startBtn.onclick = (): void => {
      this.initiateRecording();
    };

    this.stopBtn = buttonsEl.createEl("button", {
      text: "⏹️ Stop & Process",
      cls: "mod-warning",
    });
    this.stopBtn.style.display = "none";
    this.stopBtn.onclick = (): void => this.stopRecording();

    const cancelBtn = buttonsEl.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = (): void => this.cancelRecording();
  }

  private async initiateRecording(): Promise<void> {
    if (this.startBtn) this.startBtn.style.display = "none";
    if (this.stopBtn) this.stopBtn.style.display = "inline-block";
    if (this.statusEl) this.statusEl.textContent = "Recording...";
    if (this.recordingDot) this.recordingDot.addClass("active");

    await this.startRecording();
  }

  private async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = this.getSupportedMimeType();
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async (): Promise<void> => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();

        try {
          await this.onComplete(audioBlob);
        } catch (error) {
          console.error("[GPT Task Manager] Recording processing failed:", error);
          new Notice("Processing failed");
        }

        this.close();
      };

      this.mediaRecorder.onerror = (): void => {
        console.error("[GPT Task Manager] MediaRecorder error");
        new Notice("Recording error occurred");
        this.cancelRecording();
      };

      this.mediaRecorder.start(1000);
      this.startTime = Date.now();
      this.startTimer();

    } catch (error) {
      console.error("[GPT Task Manager] Failed to start recording:", error);
      new Notice("Failed to access microphone. Please check permissions.");
      this.close();
      this.onCancel();
    }
  }

  private getSupportedMimeType(): string | null {
    const mimeTypes = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mpeg",
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return null;
  }

  private startTimer(): void {
    this.timerInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const seconds = (elapsed % 60).toString().padStart(2, "0");
      if (this.timerEl) {
        this.timerEl.textContent = `${minutes}:${seconds}`;
      }
    }, 1000);
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      if (this.statusEl) this.statusEl.textContent = "Processing...";
      if (this.stopBtn) {
        this.stopBtn.disabled = true;
        this.stopBtn.textContent = "Processing...";
      }
      if (this.recordingDot) this.recordingDot.removeClass("active");
      this.mediaRecorder.stop();
    }
  }

  private cancelRecording(): void {
    this.cleanup();
    this.close();
    this.onCancel();
  }

  private cleanup(): void {
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  onClose(): void {
    this.cleanup();
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Transcribe audio using OpenAI Whisper API with cancellation support
 */
export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  model: string = "whisper-1",
  language?: string,
  cancellationToken?: CancellationToken
): Promise<string> {
  logger.info(CATEGORY, "Starting audio transcription", { 
    blobSize: audioBlob.size,
    model,
    language: language || "auto"
  });

  const response = await callWhisperApi(
    audioBlob,
    apiKey,
    model,
    language,
    cancellationToken
  );

  if (response.cancelled) {
    logger.info(CATEGORY, "Transcription was cancelled");
    throw new Error("Transcription cancelled");
  }

  if (!response.success) {
    logger.error(CATEGORY, "Transcription failed", { error: response.error });
    throw new Error(response.error || "Transcription failed");
  }

  const text = response.data?.text;
  if (!text) {
    logger.warn(CATEGORY, "Transcription returned empty text");
    throw new Error("Transcription returned empty result");
  }

  logger.info(CATEGORY, "Transcription successful", { textLength: text.length });
  return text.trim();
}

/**
 * Transcribe audio with full result object (includes cancellation status)
 */
export async function transcribeAudioWithResult(
  audioBlob: Blob,
  apiKey: string,
  model: string = "whisper-1",
  language?: string,
  cancellationToken?: CancellationToken
): Promise<TranscriptionResult> {
  logger.info(CATEGORY, "Starting audio transcription", { 
    blobSize: audioBlob.size,
    model
  });

  const response = await callWhisperApi(
    audioBlob,
    apiKey,
    model,
    language,
    cancellationToken
  );

  if (response.cancelled) {
    return {
      success: false,
      text: null,
      error: "Transcription cancelled",
      cancelled: true,
    };
  }

  if (!response.success) {
    return {
      success: false,
      text: null,
      error: response.error || "Transcription failed",
      cancelled: false,
    };
  }

  return {
    success: true,
    text: response.data?.text || null,
    error: null,
    cancelled: false,
  };
}

/**
 * Parse voice input to extract task components
 */
export function parseVoiceTaskInput(transcription: string): VoiceTaskInput {
  const result: VoiceTaskInput = {
    rawText: transcription,
    taskTitle: "",
    description: "",
    epic: "",
    project: "",
    priority: "",
  };

  const cleanedText = transcription.trim();

  // Extract priority if mentioned
  const priorityPatterns = [
    { pattern: /(?:high|높은|urgent|긴급)\s*priority/i, priority: "high" },
    { pattern: /priority[:\s]*(high|높음|urgent|긴급)/i, priority: "high" },
    { pattern: /(?:critical|크리티컬|매우\s*중요)/i, priority: "critical" },
    { pattern: /(?:low|낮은)\s*priority/i, priority: "low" },
    { pattern: /priority[:\s]*(low|낮음)/i, priority: "low" },
  ];

  for (const { pattern, priority } of priorityPatterns) {
    if (pattern.test(cleanedText)) {
      result.priority = priority;
      break;
    }
  }

  // Extract project/epic references
  const projectPatterns = [
    /(?:for|in|to)\s+(?:the\s+)?(.+?)\s+(?:project|프로젝트)/i,
    /(?:project|프로젝트)[:\s]+(.+?)(?:\.|,|$)/i,
  ];

  for (const pattern of projectPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      result.project = match[1].trim();
      break;
    }
  }

  const epicPatterns = [
    /(?:for|in|to)\s+(?:the\s+)?(.+?)\s+(?:epic|에픽)/i,
    /(?:epic|에픽)[:\s]+(.+?)(?:\.|,|$)/i,
  ];

  for (const pattern of epicPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      result.epic = match[1].trim();
      break;
    }
  }

  // Clean up the text to get task title
  let taskText = cleanedText
    .replace(/(?:high|low|critical|높은|낮은|긴급|urgent)\s*priority[:\s]*/gi, "")
    .replace(/priority[:\s]*(?:high|low|critical|medium|높음|낮음|중간)/gi, "")
    .replace(/(?:for|in|to)\s+(?:the\s+)?.+?\s+(?:project|epic|프로젝트|에픽)/gi, "")
    .replace(/(?:project|epic|프로젝트|에픽)[:\s]+.+?(?:\.|,|$)/gi, "")
    .trim();

  // Clean up multiple spaces and punctuation
  taskText = taskText
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+|[,.\s]+$/g, "")
    .trim();

  result.taskTitle = taskText;

  return result;
}

