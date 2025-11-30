/**
 * Mock for Obsidian API used in tests
 */

export class App {
  vault = new Vault();
  workspace = new Workspace();
  metadataCache = new MetadataCache();
}

export class Vault {
  private files: Map<string, TFile> = new Map();
  private folders: Map<string, TFolder> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();

  getAbstractFileByPath(path: string): TAbstractFile | null {
    return this.files.get(path) || this.folders.get(path) || null;
  }

  async create(path: string, content: string): Promise<TFile> {
    const file = new TFile(path);
    this.files.set(path, file);
    return file;
  }

  async createFolder(path: string): Promise<void> {
    const folder = new TFolder(path);
    this.folders.set(path, folder);
  }

  async read(file: TFile): Promise<string> {
    return "";
  }

  on(event: string, callback: Function): EventRef {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
    return { id: Math.random().toString() };
  }

  offref(ref: EventRef): void {
    // Remove event handler
  }
}

export class Workspace {
  async openLinkText(path: string, sourcePath: string, newLeaf: boolean): Promise<void> {
    // Mock implementation
  }
}

export class MetadataCache {
  getFileCache(file: TFile): CachedMetadata | null {
    return null;
  }
}

export interface EventRef {
  id: string;
}

export interface CachedMetadata {
  frontmatter?: Record<string, unknown>;
}

export abstract class TAbstractFile {
  path: string;
  name: string;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").pop() || "";
  }
}

export class TFile extends TAbstractFile {
  extension: string;
  basename: string;
  
  constructor(path: string) {
    super(path);
    this.extension = path.split(".").pop() || "";
    this.basename = this.name.replace(/\.[^/.]+$/, "");
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  
  constructor(path: string) {
    super(path);
  }
}

export class Modal {
  app: App;
  contentEl: HTMLElement = document.createElement("div");
  modalEl: HTMLElement = document.createElement("div");

  constructor(app: App) {
    this.app = app;
  }

  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class Notice {
  constructor(message: string, timeout?: number) {
    // Mock notice
  }
}

export class PluginSettingTab {
  app: App;
  plugin: unknown;
  containerEl: HTMLElement = document.createElement("div");

  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(containerEl: HTMLElement) {}
  setName(name: string): this { return this; }
  setDesc(desc: string): this { return this; }
  addText(callback: (text: TextComponent) => void): this { return this; }
  addTextArea(callback: (text: TextAreaComponent) => void): this { return this; }
  addToggle(callback: (toggle: ToggleComponent) => void): this { return this; }
  addDropdown(callback: (dropdown: DropdownComponent) => void): this { return this; }
  addButton(callback: (button: ButtonComponent) => void): this { return this; }
  then(callback: (setting: Setting) => void): this { return this; }
}

export class TextComponent {
  setPlaceholder(placeholder: string): this { return this; }
  setValue(value: string): this { return this; }
  onChange(callback: (value: string) => void): this { return this; }
  inputEl: HTMLInputElement = document.createElement("input");
}

export class TextAreaComponent {
  setPlaceholder(placeholder: string): this { return this; }
  setValue(value: string): this { return this; }
  onChange(callback: (value: string) => void): this { return this; }
  inputEl: HTMLTextAreaElement = document.createElement("textarea");
}

export class ToggleComponent {
  setValue(value: boolean): this { return this; }
  onChange(callback: (value: boolean) => void): this { return this; }
}

export class DropdownComponent {
  addOption(value: string, text: string): this { return this; }
  setValue(value: string): this { return this; }
  onChange(callback: (value: string) => void): this { return this; }
}

export class ButtonComponent {
  setButtonText(text: string): this { return this; }
  setWarning(): this { return this; }
  onClick(callback: () => void): this { return this; }
}

export class FuzzySuggestModal<T> extends Modal {
  setPlaceholder(placeholder: string): void {}
  getItems(): T[] { return []; }
  getItemText(item: T): string { return ""; }
  onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void {}
}

export class SuggestModal<T> extends Modal {
  setPlaceholder(placeholder: string): void {}
  setInstructions(instructions: { command: string; purpose: string }[]): void {}
  getSuggestions(query: string): T[] { return []; }
  renderSuggestion(item: T, el: HTMLElement): void {}
  onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void {}
}

export abstract class Plugin {
  app: App = new App();
  manifest: PluginManifest = { id: "", name: "", version: "", minAppVersion: "" };
  
  loadData(): Promise<unknown> { return Promise.resolve({}); }
  saveData(data: unknown): Promise<void> { return Promise.resolve(); }
  addCommand(command: Command): Command { return command; }
  addRibbonIcon(icon: string, title: string, callback: () => void): HTMLElement { 
    return document.createElement("div"); 
  }
  addSettingTab(settingTab: PluginSettingTab): void {}
  
  abstract onload(): Promise<void>;
  abstract onunload(): void;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
}

export interface Command {
  id: string;
  name: string;
  callback?: () => void;
  editorCallback?: (editor: Editor, view: MarkdownView) => void;
}

export interface Editor {
  getSelection(): string;
  replaceSelection(replacement: string): void;
}

export interface MarkdownView {
  file: TFile | null;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
  json: unknown;
}

export async function requestUrl(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  throw?: boolean;
}): Promise<RequestUrlResponse> {
  // Mock implementation
  return {
    status: 200,
    headers: {},
    text: "",
    json: {},
  };
}

export class Events {
  on(name: string, callback: Function): EventRef {
    return { id: Math.random().toString() };
  }
  off(name: string, callback: Function): void {}
  offref(ref: EventRef): void {}
  trigger(name: string, ...data: unknown[]): void {}
}

