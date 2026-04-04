/**
 * Query Cache Service
 *
 * Provides caching for frequently accessed database queries.
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class QueryCache {
  private cache: Map<string, CacheEntry<any>>
  private defaultTTL: number

  constructor(defaultTTL: number = 60000) {
    // Default TTL: 60 seconds
    this.cache = new Map()
    this.defaultTTL = defaultTTL
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    keys: string[]
    hitRate?: number
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }
}

/**
 * Cached query executor
 */
export class CachedQueryExecutor {
  constructor(private cache: QueryCache) {}

  /**
   * Execute query with caching
   */
  async execute<T>(
    key: string,
    queryFn: () => T | Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = this.cache.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute query
    const result = await queryFn()

    // Cache result
    this.cache.set(key, result, ttl)

    return result
  }

  /**
   * Invalidate cache for a file
   */
  invalidateFile(filePath: string): void {
    this.cache.invalidatePattern(new RegExp(`file:${filePath}`))
  }

  /**
   * Invalidate cache for a function
   */
  invalidateFunction(functionName: string): void {
    this.cache.invalidatePattern(new RegExp(`function:${functionName}`))
  }

  /**
   * Invalidate all coverage-related cache
   */
  invalidateCoverage(): void {
    this.cache.invalidatePattern(/^coverage:/)
  }
}
