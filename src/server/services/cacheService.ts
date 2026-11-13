import type { Libro } from '../../types/sgbi.ts';

interface CacheEntry {
  ids: number[];
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;

class SearchCacheService {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  private normalizeKey(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  get(query: string): number[] | null {
    const key = this.normalizeKey(query);
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }

    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.ids;
  }

  set(query: string, libros: Libro[]): void {
    const key = this.normalizeKey(query);
    if (!key) return;

    if (this.store.size >= MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      ids: libros.map((l) => l.id_libro),
      expiresAt: Date.now() + DEFAULT_TTL_MS,
    });
  }

  invalidateAll(): void {
    this.store.clear();
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.store.size,
      hitRatePct: total > 0 ? Math.round((this.hits / total) * 1000) / 10 : 0,
      ttlSeconds: DEFAULT_TTL_MS / 1000,
    };
  }
}

export const semanticSearchCache = new SearchCacheService();
