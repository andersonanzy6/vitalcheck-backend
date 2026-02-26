/**
 * Simple in-memory cache with TTL support
 * Reduces API calls for symptom check responses
 */

class Cache {
  constructor(ttlMinutes = 60) {
    this.store = new Map();
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate cache key from message content
   */
  generateKey(messages) {
    const content = messages.map(m => m.content).join("|").toLowerCase();
    return Buffer.from(content).toString('base64');
  }

  /**
   * Get value from cache
   */
  get(key) {
    const item = this.store.get(key);
    
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set value in cache
   */
  set(key, value) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear all cache
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.store.size,
      ttlMinutes: this.ttlMs / (60 * 1000),
    };
  }
}

// Singleton instance for symptom check cache
const symptomCheckCache = new Cache(30); // 30 minute TTL

module.exports = {
  symptomCheckCache,
  Cache,
};
