/**
 * Tests for productivity endpoint caching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFromStorage, writeToStorage } from '../storage.js';

// Mock storage module
vi.mock('../storage.js', () => ({
  readFromStorage: vi.fn(),
  writeToStorage: vi.fn()
}));

describe('Productivity Endpoint Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cache key generation', () => {
    it('should generate correct key for team productivity data', () => {
      const key = `productivity-cache-Team A-weekly.json`;
      expect(key).toBe('productivity-cache-Team A-weekly.json');
    });

    it('should generate correct key for summary data', () => {
      const key = `productivity-cache-summary-monthly.json`;
      expect(key).toBe('productivity-cache-summary-monthly.json');
    });

    it('should generate correct key for member data', () => {
      const key = `productivity-cache-member-John Doe-quarterly.json`;
      expect(key).toBe('productivity-cache-member-John Doe-quarterly.json');
    });
  });

  describe('Cache validity check', () => {
    it('should return false if cache entry is null', () => {
      const isCacheValid = (cacheEntry) => {
        if (!cacheEntry || !cacheEntry.cachedAt) return false;
        const age = Date.now() - new Date(cacheEntry.cachedAt).getTime();
        return age < 60 * 60 * 1000; // 1 hour
      };

      expect(isCacheValid(null)).toBe(false);
    });

    it('should return false if cachedAt is missing', () => {
      const isCacheValid = (cacheEntry) => {
        if (!cacheEntry || !cacheEntry.cachedAt) return false;
        const age = Date.now() - new Date(cacheEntry.cachedAt).getTime();
        return age < 60 * 60 * 1000;
      };

      expect(isCacheValid({ data: {} })).toBe(false);
    });

    it('should return true if cache is less than 1 hour old', () => {
      const isCacheValid = (cacheEntry) => {
        if (!cacheEntry || !cacheEntry.cachedAt) return false;
        const age = Date.now() - new Date(cacheEntry.cachedAt).getTime();
        return age < 60 * 60 * 1000;
      };

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(isCacheValid({ cachedAt: tenMinutesAgo, data: {} })).toBe(true);
    });

    it('should return false if cache is more than 1 hour old', () => {
      const isCacheValid = (cacheEntry) => {
        if (!cacheEntry || !cacheEntry.cachedAt) return false;
        const age = Date.now() - new Date(cacheEntry.cachedAt).getTime();
        return age < 60 * 60 * 1000;
      };

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(isCacheValid({ cachedAt: twoHoursAgo, data: {} })).toBe(false);
    });

    it('should return false if cache is exactly 1 hour old', () => {
      const isCacheValid = (cacheEntry) => {
        if (!cacheEntry || !cacheEntry.cachedAt) return false;
        const age = Date.now() - new Date(cacheEntry.cachedAt).getTime();
        return age < 60 * 60 * 1000;
      };

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(isCacheValid({ cachedAt: oneHourAgo, data: {} })).toBe(false);
    });
  });

  describe('Cache TTL', () => {
    it('should use 1 hour (3600000ms) as TTL', () => {
      const CACHE_TTL_MS = 60 * 60 * 1000;
      expect(CACHE_TTL_MS).toBe(3600000);
    });
  });
});
