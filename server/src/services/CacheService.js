import { getRedisClient, isRedisAvailable } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// In-memory cache fallback store: Map<key, { value, expiresAt }>
const inMemoryCache = new Map();

// In-flight promises map for cache stampede protection (single-flight coalescing)
const inFlightRequests = new Map();

export const CACHE_TTLS = Object.freeze({
  DATASET_METADATA: 120, // 2 minutes
  GLOSSARY_LOOKUP: 300,  // 5 minutes
  DASHBOARD_SUMMARY: 60, // 1 minute
  COMPLIANCE_REPORT: 120,// 2 minutes
  QUALITY_SUMMARY: 120   // 2 minutes
});

// Cache performance metrics tracking
let cacheHits = 0;
let cacheMisses = 0;

export class CacheService {
  /**
   * Generates a strictly tenant-isolated cache key.
   * Format: tenant:{organizationId}:{namespace}:{id}
   */
  static buildKey(organizationId, namespace, id = '') {
    if (!organizationId) {
      throw new Error('organizationId is required for tenant cache isolation');
    }
    const cleanId = id ? `:${id}` : '';
    return `tenant:${organizationId}:${namespace}${cleanId}`;
  }

  static datasetKey(orgId, datasetId) {
    return this.buildKey(orgId, 'dataset', datasetId);
  }

  static glossaryKey(orgId, termId = 'list') {
    return this.buildKey(orgId, 'glossary', termId);
  }

  static dashboardKey(orgId, view = 'summary') {
    return this.buildKey(orgId, 'dashboard', view);
  }

  static complianceKey(orgId) {
    return this.buildKey(orgId, 'compliance', 'report');
  }

  static qualityKey(orgId, datasetId) {
    return this.buildKey(orgId, 'quality', datasetId);
  }

  /**
   * Retrieves a value from cache (Redis or in-memory fallback).
   */
  static async get(key) {
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const raw = await client.get(key);
        if (raw !== null) {
          cacheHits++;
          return JSON.parse(raw);
        }
      } catch (err) {
        logger.warn(`[Cache] Redis GET failed for key "${key}": ${err.message}. Falling back.`);
      }
    }

    // In-memory fallback
    const entry = inMemoryCache.get(key);
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        cacheHits++;
        return entry.value;
      }
      inMemoryCache.delete(key);
    }

    cacheMisses++;
    return null;
  }

  /**
   * Sets a value in cache with a defined TTL (in seconds).
   */
  static async set(key, value, ttlSeconds = 60) {
    if (value === undefined) return;

    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (err) {
        logger.warn(`[Cache] Redis SET failed for key "${key}": ${err.message}. Using fallback.`);
      }
    }

    // In-memory fallback
    inMemoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  /**
   * Deletes a specific key from cache.
   */
  static async del(key) {
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        await client.del(key);
      } catch (err) {
        logger.warn(`[Cache] Redis DEL failed for key "${key}": ${err.message}`);
      }
    }
    inMemoryCache.delete(key);
  }

  /**
   * Deletes all keys matching a pattern (e.g. "tenant:orgId:dataset:*").
   */
  static async delPattern(pattern) {
    if (isRedisAvailable()) {
      try {
        const client = getRedisClient();
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch (err) {
        logger.warn(`[Cache] Redis DEL pattern "${pattern}" failed: ${err.message}`);
      }
    }

    // In-memory wildcard deletion
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of inMemoryCache.keys()) {
      if (regexPattern.test(k)) {
        inMemoryCache.delete(k);
      }
    }
  }

  /**
   * Cache stampede protection: single-flight coalescing.
   * If 10 concurrent calls request the same uncached key, only 1 database fetch executes.
   */
  static async coalesce(key, fetchFn, ttlSeconds = 60) {
    // 1. Check cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Check if a fetch is already in flight
    if (inFlightRequests.has(key)) {
      return await inFlightRequests.get(key);
    }

    // 3. Initiate fetch and register in flight promise
    const promise = (async () => {
      try {
        const result = await fetchFn();
        if (result !== undefined && result !== null) {
          await this.set(key, result, ttlSeconds);
        }
        return result;
      } finally {
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, promise);
    return await promise;
  }

  // Domain-specific invalidation helpers
  static async invalidateDataset(orgId, datasetId) {
    await Promise.all([
      this.del(this.datasetKey(orgId, datasetId)),
      this.delPattern(`tenant:${orgId}:dataset:*`),
      this.invalidateDashboard(orgId)
    ]);
  }

  static async invalidateGlossary(orgId) {
    await this.delPattern(`tenant:${orgId}:glossary:*`);
  }

  static async invalidateCompliance(orgId) {
    await this.del(this.complianceKey(orgId));
  }

  static async invalidateQuality(orgId, datasetId) {
    await Promise.all([
      this.del(this.qualityKey(orgId, datasetId)),
      this.delPattern(`tenant:${orgId}:quality:*`),
      this.invalidateDashboard(orgId)
    ]);
  }

  static async invalidateDashboard(orgId) {
    await this.delPattern(`tenant:${orgId}:dashboard:*`);
  }

  /**
   * Returns cache diagnostic stats.
   */
  static getStats() {
    const total = cacheHits + cacheMisses;
    const hitRate = total > 0 ? Math.round((cacheHits / total) * 10000) / 100 : 0;

    return {
      hits: cacheHits,
      misses: cacheMisses,
      hitRatePercentage: hitRate,
      inMemoryEntriesCount: inMemoryCache.size,
      redisActive: isRedisAvailable()
    };
  }

  /**
   * Resets cache metrics (useful in test teardown).
   */
  static resetStats() {
    cacheHits = 0;
    cacheMisses = 0;
    inMemoryCache.clear();
    inFlightRequests.clear();
  }
}

export default CacheService;
