/**
 * Internationalization (i18n) system
 * Provides localized strings for UI elements
 */

export type SupportedLocale = "en" | "ko" | "ja" | "zh";

/**
 * Translation keys and their values
 */
export interface TranslationStrings {
  // Common
  cancel: string;
  confirm: string;
  create: string;
  save: string;
  delete: string;
  close: string;
  loading: string;
  error: string;
  success: string;
  retry: string;

  // Task creation
  quickTaskTitle: string;
  quickTaskDescription: string;
  quickTaskPlaceholder: string;
  createWithAi: string;
  simpleCreate: string;
  taskCreationCancelled: string;
  taskCreated: string;
  taskCreationFailed: string;
  pleaseEnterDescription: string;
  pleaseSelectText: string;

  // Voice
  voiceRecording: string;
  voiceRecordingStart: string;
  voiceRecordingStop: string;
  voiceRecordingCancel: string;
  voiceTranscribing: string;
  voiceInstructions: string;

  // Review modal
  reviewTask: string;
  reviewTitle: string;
  reviewObjective: string;
  reviewImportance: string;
  reviewEpic: string;
  reviewPriority: string;
  reviewSubtasks: string;
  noEpic: string;
  createTask: string;

  // Breakdown
  breakdownTitle: string;
  breakdownDescription: string;
  breakdownTaskCount: string;
  breakdownDependsOn: string;
  breakdownCreating: string;

  // Confirmation
  confirmTaskCreation: string;
  confirmTaskCreationSingle: string;
  confirmTasksWillBeCreated: string;
  confirmTargetFolder: string;
  confirmCreateTasks: string;
  confirmCreateTask: string;

  // Errors
  errorNoApiKey: string;
  errorVoiceDisabled: string;
  errorNoEpics: string;
  errorNoSelection: string;
  errorRateLimited: string;
  errorTimeout: string;
  errorServerError: string;
  errorAuthFailed: string;
  errorParsingFailed: string;
  errorBreakdownTooLarge: string;
  errorBreakdownEmpty: string;

  // Progress
  progressProcessing: string;
  progressBreakingDown: string;
  progressCreatingTasks: string;
  progressTranscribing: string;

  // Settings
  settingsApiConfig: string;
  settingsVaultPaths: string;
  settingsFeatures: string;
  settingsDefaults: string;
  settingsPrompts: string;
  settingsReset: string;

  // Conflict resolution
  conflictFileExists: string;
  conflictRename: string;
  conflictOverwrite: string;
  conflictSkip: string;

  // Accessibility
  ariaCloseModal: string;
  ariaConfirmButton: string;
  ariaCancelButton: string;
  ariaLoadingIndicator: string;
  ariaTaskList: string;
  ariaPriorityBadge: string;

  // Kanban Integration
  kanbanNotEnabled: string;
  kanbanLoading: string;
  kanbanLoadingEpic: string;
  kanbanLoadingProject: string;
  kanbanNoProjects: string;
  kanbanNoActiveBoard: string;
  kanbanNotABoard: string;
  kanbanRefreshed: string;
  kanbanOpenAllTasks: string;
  kanbanOpenEpicBoard: string;
  kanbanOpenProjectBoard: string;
}

/**
 * English translations (default)
 */
const en: TranslationStrings = {
  // Common
  cancel: "Cancel",
  confirm: "Confirm",
  create: "Create",
  save: "Save",
  delete: "Delete",
  close: "Close",
  loading: "Loading...",
  error: "Error",
  success: "Success",
  retry: "Retry",

  // Task creation
  quickTaskTitle: "🚀 Quick Task Creation",
  quickTaskDescription: "Describe your task naturally. GPT will help structure it based on your goals and projects.",
  quickTaskPlaceholder: "e.g., Create a landing page for the Freedom Runway project with high priority",
  createWithAi: "✨ Create with AI",
  simpleCreate: "Create (No AI)",
  taskCreationCancelled: "Task creation cancelled",
  taskCreated: "✅ Created task: {title}",
  taskCreationFailed: "Failed to create task: {error}",
  pleaseEnterDescription: "Please enter a task description",
  pleaseSelectText: "Please select some text first",

  // Voice
  voiceRecording: "🎤 Voice Recording",
  voiceRecordingStart: "Start Recording",
  voiceRecordingStop: "Stop Recording",
  voiceRecordingCancel: "Cancel",
  voiceTranscribing: "🎤 Transcribing...",
  voiceInstructions: "Speak clearly and describe your task. Include priority, epic, or project names if relevant.",

  // Review modal
  reviewTask: "📋 Review Task",
  reviewTitle: "Title",
  reviewObjective: "Objective",
  reviewImportance: "Why it matters",
  reviewEpic: "Epic",
  reviewPriority: "Priority",
  reviewSubtasks: "Suggested Subtasks ({count})",
  noEpic: "-- No Epic --",
  createTask: "✓ Create Task",

  // Breakdown
  breakdownTitle: "📊 Task Breakdown: {epic}",
  breakdownDescription: "{count} tasks will be created:",
  breakdownTaskCount: "{count} tasks",
  breakdownDependsOn: "Depends on: Task {index}",
  breakdownCreating: "🤖 Breaking down: {epic}...",

  // Confirmation
  confirmTaskCreation: "📋 Confirm Task Creation ({count} tasks)",
  confirmTaskCreationSingle: "📋 Confirm Task Creation",
  confirmTasksWillBeCreated: "The following tasks will be created:",
  confirmTargetFolder: "📁 {folder}",
  confirmCreateTasks: "✓ Create {count} Tasks",
  confirmCreateTask: "✓ Create Task",

  // Errors
  errorNoApiKey: "Please set your OpenAI API key in settings first.",
  errorVoiceDisabled: "Voice input is disabled. Enable it in settings.",
  errorNoEpics: "No epics found in your vault.",
  errorNoSelection: "Please select some text first.",
  errorRateLimited: "Rate limited. Please wait {seconds} seconds.",
  errorTimeout: "Request timed out. Please try again.",
  errorServerError: "Server error. Please try again later.",
  errorAuthFailed: "Authentication failed. Please check your API key.",
  errorParsingFailed: "Failed to parse GPT response. Creating simple task.",
  errorBreakdownTooLarge: "GPT returned {count} tasks (max {max}). Truncated to first {max}.",
  errorBreakdownEmpty: "GPT returned no tasks. Please try again or adjust your epic description.",

  // Progress
  progressProcessing: "🤖 Processing with GPT...",
  progressBreakingDown: "🤖 Breaking down epic...",
  progressCreatingTasks: "Creating tasks...",
  progressTranscribing: "🎤 Transcribing audio...",

  // Settings
  settingsApiConfig: "🔑 API Configuration",
  settingsVaultPaths: "📁 Vault Paths",
  settingsFeatures: "⚡ Features",
  settingsDefaults: "📋 Task Defaults",
  settingsPrompts: "🤖 GPT Prompts",
  settingsReset: "🔄 Reset",

  // Conflict resolution
  conflictFileExists: "File already exists: {filename}",
  conflictRename: "Rename",
  conflictOverwrite: "Overwrite",
  conflictSkip: "Skip",

  // Accessibility
  ariaCloseModal: "Close modal",
  ariaConfirmButton: "Confirm action",
  ariaCancelButton: "Cancel action",
  ariaLoadingIndicator: "Loading, please wait",
  ariaTaskList: "Task list",
  ariaPriorityBadge: "Priority: {priority}",

  // Kanban Integration
  kanbanNotEnabled: "Kanban integration is not enabled. Enable it in settings.",
  kanbanLoading: "📋 Loading Kanban board...",
  kanbanLoadingEpic: "📋 Loading Kanban board for Epic: {epic}...",
  kanbanLoadingProject: "📋 Loading Kanban board for Project: {project}...",
  kanbanNoProjects: "No projects found in your vault.",
  kanbanNoActiveBoard: "No Kanban board is currently open.",
  kanbanNotABoard: "The current file is not a Kanban board.",
  kanbanRefreshed: "✅ Kanban board refreshed",
  kanbanOpenAllTasks: "Open All Tasks Board",
  kanbanOpenEpicBoard: "Open Board for Epic",
  kanbanOpenProjectBoard: "Open Board for Project",
};

/**
 * Korean translations
 */
const ko: TranslationStrings = {
  // Common
  cancel: "취소",
  confirm: "확인",
  create: "생성",
  save: "저장",
  delete: "삭제",
  close: "닫기",
  loading: "로딩 중...",
  error: "오류",
  success: "성공",
  retry: "재시도",

  // Task creation
  quickTaskTitle: "🚀 빠른 태스크 생성",
  quickTaskDescription: "태스크를 자연스럽게 설명하세요. GPT가 목표와 프로젝트에 맞게 구조화합니다.",
  quickTaskPlaceholder: "예: Freedom Runway 프로젝트의 랜딩 페이지를 높은 우선순위로 만들기",
  createWithAi: "✨ AI로 생성",
  simpleCreate: "생성 (AI 없이)",
  taskCreationCancelled: "태스크 생성이 취소되었습니다",
  taskCreated: "✅ 태스크 생성됨: {title}",
  taskCreationFailed: "태스크 생성 실패: {error}",
  pleaseEnterDescription: "태스크 설명을 입력하세요",
  pleaseSelectText: "먼저 텍스트를 선택하세요",

  // Voice
  voiceRecording: "🎤 음성 녹음",
  voiceRecordingStart: "녹음 시작",
  voiceRecordingStop: "녹음 중지",
  voiceRecordingCancel: "취소",
  voiceTranscribing: "🎤 변환 중...",
  voiceInstructions: "명확하게 말하고 태스크를 설명하세요. 우선순위, 에픽 또는 프로젝트 이름을 포함하세요.",

  // Review modal
  reviewTask: "📋 태스크 검토",
  reviewTitle: "제목",
  reviewObjective: "목표",
  reviewImportance: "중요한 이유",
  reviewEpic: "에픽",
  reviewPriority: "우선순위",
  reviewSubtasks: "제안된 하위 태스크 ({count})",
  noEpic: "-- 에픽 없음 --",
  createTask: "✓ 태스크 생성",

  // Breakdown
  breakdownTitle: "📊 태스크 분해: {epic}",
  breakdownDescription: "{count}개의 태스크가 생성됩니다:",
  breakdownTaskCount: "{count}개 태스크",
  breakdownDependsOn: "의존: 태스크 {index}",
  breakdownCreating: "🤖 분해 중: {epic}...",

  // Confirmation
  confirmTaskCreation: "📋 태스크 생성 확인 ({count}개)",
  confirmTaskCreationSingle: "📋 태스크 생성 확인",
  confirmTasksWillBeCreated: "다음 태스크가 생성됩니다:",
  confirmTargetFolder: "📁 {folder}",
  confirmCreateTasks: "✓ {count}개 태스크 생성",
  confirmCreateTask: "✓ 태스크 생성",

  // Errors
  errorNoApiKey: "먼저 설정에서 OpenAI API 키를 설정하세요.",
  errorVoiceDisabled: "음성 입력이 비활성화되어 있습니다. 설정에서 활성화하세요.",
  errorNoEpics: "볼트에서 에픽을 찾을 수 없습니다.",
  errorNoSelection: "먼저 텍스트를 선택하세요.",
  errorRateLimited: "요청 제한됨. {seconds}초 후에 다시 시도하세요.",
  errorTimeout: "요청 시간 초과. 다시 시도하세요.",
  errorServerError: "서버 오류. 나중에 다시 시도하세요.",
  errorAuthFailed: "인증 실패. API 키를 확인하세요.",
  errorParsingFailed: "GPT 응답 파싱 실패. 간단한 태스크를 생성합니다.",
  errorBreakdownTooLarge: "GPT가 {count}개 태스크를 반환했습니다 (최대 {max}). 처음 {max}개만 사용합니다.",
  errorBreakdownEmpty: "GPT가 태스크를 반환하지 않았습니다. 다시 시도하거나 에픽 설명을 수정하세요.",

  // Progress
  progressProcessing: "🤖 GPT로 처리 중...",
  progressBreakingDown: "🤖 에픽 분해 중...",
  progressCreatingTasks: "태스크 생성 중...",
  progressTranscribing: "🎤 오디오 변환 중...",

  // Settings
  settingsApiConfig: "🔑 API 설정",
  settingsVaultPaths: "📁 볼트 경로",
  settingsFeatures: "⚡ 기능",
  settingsDefaults: "📋 태스크 기본값",
  settingsPrompts: "🤖 GPT 프롬프트",
  settingsReset: "🔄 초기화",

  // Conflict resolution
  conflictFileExists: "파일이 이미 존재합니다: {filename}",
  conflictRename: "이름 변경",
  conflictOverwrite: "덮어쓰기",
  conflictSkip: "건너뛰기",

  // Accessibility
  ariaCloseModal: "모달 닫기",
  ariaConfirmButton: "작업 확인",
  ariaCancelButton: "작업 취소",
  ariaLoadingIndicator: "로딩 중입니다. 잠시 기다려주세요",
  ariaTaskList: "태스크 목록",
  ariaPriorityBadge: "우선순위: {priority}",

  // Kanban Integration
  kanbanNotEnabled: "칸반 통합이 활성화되지 않았습니다. 설정에서 활성화하세요.",
  kanbanLoading: "📋 칸반 보드 로딩 중...",
  kanbanLoadingEpic: "📋 에픽 칸반 보드 로딩 중: {epic}...",
  kanbanLoadingProject: "📋 프로젝트 칸반 보드 로딩 중: {project}...",
  kanbanNoProjects: "볼트에서 프로젝트를 찾을 수 없습니다.",
  kanbanNoActiveBoard: "현재 열려 있는 칸반 보드가 없습니다.",
  kanbanNotABoard: "현재 파일은 칸반 보드가 아닙니다.",
  kanbanRefreshed: "✅ 칸반 보드가 새로고침되었습니다",
  kanbanOpenAllTasks: "전체 태스크 보드 열기",
  kanbanOpenEpicBoard: "에픽 보드 열기",
  kanbanOpenProjectBoard: "프로젝트 보드 열기",
};

/**
 * Japanese translations
 */
const ja: TranslationStrings = {
  ...en, // Fallback to English for incomplete translations
  cancel: "キャンセル",
  confirm: "確認",
  create: "作成",
  save: "保存",
  delete: "削除",
  close: "閉じる",
  loading: "読み込み中...",
  error: "エラー",
  success: "成功",
  retry: "再試行",
  quickTaskTitle: "🚀 クイックタスク作成",
  createWithAi: "✨ AIで作成",
  taskCreationCancelled: "タスク作成がキャンセルされました",
  // Kanban
  kanbanNotEnabled: "カンバン統合が有効になっていません。設定で有効にしてください。",
  kanbanLoading: "📋 カンバンボードを読み込み中...",
  kanbanRefreshed: "✅ カンバンボードを更新しました",
};

/**
 * Chinese (Simplified) translations
 */
const zh: TranslationStrings = {
  ...en, // Fallback to English for incomplete translations
  cancel: "取消",
  confirm: "确认",
  create: "创建",
  save: "保存",
  delete: "删除",
  close: "关闭",
  loading: "加载中...",
  error: "错误",
  success: "成功",
  retry: "重试",
  quickTaskTitle: "🚀 快速创建任务",
  createWithAi: "✨ AI创建",
  taskCreationCancelled: "任务创建已取消",
  // Kanban
  kanbanNotEnabled: "看板集成未启用。请在设置中启用。",
  kanbanLoading: "📋 正在加载看板...",
  kanbanRefreshed: "✅ 看板已刷新",
};

/**
 * All available translations
 */
const translations: Record<SupportedLocale, TranslationStrings> = {
  en,
  ko,
  ja,
  zh,
};

/**
 * Current locale
 */
let currentLocale: SupportedLocale = "en";

/**
 * Set the current locale
 */
export function setLocale(locale: SupportedLocale): void {
  if (translations[locale]) {
    currentLocale = locale;
  } else {
    console.warn(`[GPT Task Manager] Unsupported locale: ${locale}, falling back to English`);
    currentLocale = "en";
  }
}

/**
 * Get the current locale
 */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * Get all supported locales
 */
export function getSupportedLocales(): SupportedLocale[] {
  return Object.keys(translations) as SupportedLocale[];
}

/**
 * Get a translated string with optional parameter substitution
 */
export function t(key: keyof TranslationStrings, params?: Record<string, string | number>): string {
  const strings = translations[currentLocale] || translations.en;
  let text = strings[key] || translations.en[key] || key;

  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
    }
  }

  return text;
}

/**
 * Get translations object for current locale
 */
export function getTranslations(): TranslationStrings {
  return translations[currentLocale] || translations.en;
}

/**
 * Detect locale from Obsidian's language setting or browser
 */
export function detectLocale(): SupportedLocale {
  // Try to get from navigator.language
  if (typeof navigator !== "undefined" && navigator.language) {
    const browserLang = navigator.language.split("-")[0].toLowerCase();
    if (browserLang in translations) {
      return browserLang as SupportedLocale;
    }
  }
  return "en";
}

