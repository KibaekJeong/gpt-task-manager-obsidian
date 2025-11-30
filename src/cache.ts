/**
 * Caching system for vault context with cheap invalidation
 */

import { App, TFile, TFolder, Events } from "obsidian";
import { logger } from "./logger";

const CATEGORY = "Cache";

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  ttlMs: number;          // Time-to-live in milliseconds
  maxEntries: number;     // Maximum number of entries
  debounceMs: number;     // Debounce time for invalidation
}

const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 60000,           // 1 minute
  maxEntries: 50,
  debounceMs: 500,
};

/**
 * Generic cache implementation with TTL and LRU eviction
 */
class Cache<T> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private globalVersion: number = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get a cached value
   */
  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.entries.delete(key);
      this.removeFromAccessOrder(key);
      logger.debug(CATEGORY, `Cache expired: ${key}`);
      return null;
    }

    // Check version
    if (entry.version !== this.globalVersion) {
      this.entries.delete(key);
      this.removeFromAccessOrder(key);
      logger.debug(CATEGORY, `Cache invalidated (version mismatch): ${key}`);
      return null;
    }

    // Update access order (LRU)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);

    logger.debug(CATEGORY, `Cache hit: ${key}`);
    return entry.data;
  }

  /**
   * Set a cached value
   */
  set(key: string, data: T): void {
    // Evict if at capacity
    while (this.entries.size >= this.config.maxEntries && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.entries.delete(oldestKey);
        logger.debug(CATEGORY, `Cache evicted (LRU): ${oldestKey}`);
      }
    }

    this.entries.set(key, {
      data,
      timestamp: Date.now(),
      version: this.globalVersion,
    });

    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
    logger.debug(CATEGORY, `Cache set: ${key}`);
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): void {
    this.entries.delete(key);
    this.removeFromAccessOrder(key);
  }

  /**
   * Invalidate all entries (cheap operation - just bump version)
   */
  invalidateAll(): void {
    this.globalVersion++;
    logger.debug(CATEGORY, `Cache invalidated all (version: ${this.globalVersion})`);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.accessOrder = [];
    this.globalVersion++;
    logger.debug(CATEGORY, "Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; version: number } {
    return {
      size: this.entries.size,
      maxSize: this.config.maxEntries,
      version: this.globalVersion,
    };
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

/**
 * Vault context cache manager
 */
export class ContextCache {
  private app: App;
  private goalsCache: Cache<unknown[]>;
  private projectsCache: Cache<unknown[]>;
  private epicsCache: Cache<unknown[]>;
  private tasksCache: Cache<unknown[]>;
  private metadataCache: Cache<unknown>;
  
  private invalidationTimeout: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private registeredEvents: (() => void)[] = [];

  constructor(app: App, config: Partial<CacheConfig> = {}) {
    this.app = app;
    this.debounceMs = config.debounceMs || DEFAULT_CONFIG.debounceMs;
    
    this.goalsCache = new Cache(config);
    this.projectsCache = new Cache(config);
    this.epicsCache = new Cache(config);
    this.tasksCache = new Cache(config);
    this.metadataCache = new Cache(config);

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for automatic invalidation
   */
  private setupEventListeners(): void {
    // Listen for vault changes
    const modifyRef = this.app.vault.on("modify", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        this.debouncedInvalidate();
      }
    });

    const createRef = this.app.vault.on("create", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        this.debouncedInvalidate();
      }
    });

    const deleteRef = this.app.vault.on("delete", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        this.debouncedInvalidate();
      }
    });

    const renameRef = this.app.vault.on("rename", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        this.debouncedInvalidate();
      }
    });

    // Store cleanup functions
    this.registeredEvents.push(
      () => this.app.vault.offref(modifyRef),
      () => this.app.vault.offref(createRef),
      () => this.app.vault.offref(deleteRef),
      () => this.app.vault.offref(renameRef)
    );

    logger.info(CATEGORY, "Cache event listeners registered");
  }

  /**
   * Debounced invalidation to prevent excessive cache clears
   */
  private debouncedInvalidate(): void {
    if (this.invalidationTimeout) {
      clearTimeout(this.invalidationTimeout);
    }
    
    this.invalidationTimeout = setTimeout(() => {
      this.invalidateAll();
      this.invalidationTimeout = null;
    }, this.debounceMs);
  }

  /**
   * Get cached goals or load them
   */
  getGoals(key: string, loader: () => unknown[]): unknown[] {
    const cached = this.goalsCache.get(key);
    if (cached !== null) {
      return cached;
    }
    const data = loader();
    this.goalsCache.set(key, data);
    return data;
  }

  /**
   * Get cached projects or load them
   */
  getProjects(key: string, loader: () => unknown[]): unknown[] {
    const cached = this.projectsCache.get(key);
    if (cached !== null) {
      return cached;
    }
    const data = loader();
    this.projectsCache.set(key, data);
    return data;
  }

  /**
   * Get cached epics or load them
   */
  getEpics(key: string, loader: () => unknown[]): unknown[] {
    const cached = this.epicsCache.get(key);
    if (cached !== null) {
      return cached;
    }
    const data = loader();
    this.epicsCache.set(key, data);
    return data;
  }

  /**
   * Get cached tasks or load them
   */
  getTasks(key: string, loader: () => unknown[]): unknown[] {
    const cached = this.tasksCache.get(key);
    if (cached !== null) {
      return cached;
    }
    const data = loader();
    this.tasksCache.set(key, data);
    return data;
  }

  /**
   * Get cached metadata or load it
   */
  getMetadata<T>(key: string, loader: () => T): T {
    const cached = this.metadataCache.get(key);
    if (cached !== null) {
      return cached as T;
    }
    const data = loader();
    this.metadataCache.set(key, data);
    return data;
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    this.goalsCache.invalidateAll();
    this.projectsCache.invalidateAll();
    this.epicsCache.invalidateAll();
    this.tasksCache.invalidateAll();
    this.metadataCache.invalidateAll();
    logger.info(CATEGORY, "All caches invalidated");
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.goalsCache.clear();
    this.projectsCache.clear();
    this.epicsCache.clear();
    this.tasksCache.clear();
    this.metadataCache.clear();
    logger.info(CATEGORY, "All caches cleared");
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, { size: number; maxSize: number; version: number }> {
    return {
      goals: this.goalsCache.getStats(),
      projects: this.projectsCache.getStats(),
      epics: this.epicsCache.getStats(),
      tasks: this.tasksCache.getStats(),
      metadata: this.metadataCache.getStats(),
    };
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    for (const cleanup of this.registeredEvents) {
      cleanup();
    }
    this.registeredEvents = [];
    
    if (this.invalidationTimeout) {
      clearTimeout(this.invalidationTimeout);
      this.invalidationTimeout = null;
    }
    
    this.clear();
    logger.info(CATEGORY, "Cache destroyed");
  }
}

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>): void => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, waitMs);
  };
}

/**
 * Throttle function for rate-limited operations
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    const now = Date.now();
    const remaining = limitMs - (now - lastRun);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastRun = now;
      func(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastRun = Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  };
}

