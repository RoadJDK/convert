import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

// Rate limits configuration (per hour)
export const RATE_LIMITS = {
  conversions: 100,  // 100 file conversions per hour
  renames: 150,      // 150 AI renames per hour
} as const;

type RateLimitType = keyof typeof RATE_LIMITS;

const STORAGE_KEY_PREFIX = 'rate_limit_timestamps_';
const ONE_HOUR_MS = 60 * 60 * 1000;

// Get timestamps from localStorage
function getStoredTimestamps(type: RateLimitType): number[] {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`);
    if (!stored) return [];
    const timestamps = JSON.parse(stored) as number[];
    return Array.isArray(timestamps) ? timestamps : [];
  } catch {
    return [];
  }
}

// Save timestamps to localStorage
function saveTimestamps(type: RateLimitType, timestamps: number[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${type}`, JSON.stringify(timestamps));
  } catch {
    // localStorage might be full or unavailable, continue anyway
  }
}

// Clean old timestamps (older than 1 hour)
function cleanOldTimestamps(timestamps: number[]): number[] {
  const oneHourAgo = Date.now() - ONE_HOUR_MS;
  return timestamps.filter(t => t > oneHourAgo);
}

export const useRateLimiter = () => {
  // Use refs to store timestamps in memory for current session
  const timestampsRef = useRef<Record<RateLimitType, number[]>>({
    conversions: [],
    renames: [],
  });

  // Initialize from localStorage on first use
  const initializeTimestamps = useCallback((type: RateLimitType): number[] => {
    if (timestampsRef.current[type].length === 0) {
      timestampsRef.current[type] = getStoredTimestamps(type);
    }
    return timestampsRef.current[type];
  }, []);

  const checkRateLimit = useCallback((type: RateLimitType): {
    allowed: boolean;
    remaining: number;
    waitTimeSeconds: number;
  } => {
    const now = Date.now();
    const limit = RATE_LIMITS[type];

    // Get and clean timestamps
    let timestamps = initializeTimestamps(type);
    timestamps = cleanOldTimestamps(timestamps);

    // Update storage with cleaned timestamps
    timestampsRef.current[type] = timestamps;
    saveTimestamps(type, timestamps);

    const remaining = limit - timestamps.length;

    if (timestamps.length >= limit) {
      // Find when the oldest timestamp will expire
      const oldestTimestamp = Math.min(...timestamps);
      const waitTimeMs = (oldestTimestamp + ONE_HOUR_MS) - now;
      const waitTimeSeconds = Math.ceil(waitTimeMs / 1000);

      return {
        allowed: false,
        remaining: 0,
        waitTimeSeconds: Math.max(0, waitTimeSeconds),
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1, // -1 because we're about to use one
      waitTimeSeconds: 0,
    };
  }, [initializeTimestamps]);

  const recordUsage = useCallback((type: RateLimitType): boolean => {
    const { allowed, waitTimeSeconds } = checkRateLimit(type);

    if (!allowed) {
      const minutes = Math.ceil(waitTimeSeconds / 60);
      const typeLabel = type === 'conversions' ? 'Konvertierungen' : 'KI-Umbenennungen';
      toast.error(`Rate Limit erreicht für ${typeLabel}. Bitte warte ${minutes} Minute${minutes > 1 ? 'n' : ''}.`);
      return false;
    }

    // Record the usage
    const now = Date.now();
    timestampsRef.current[type] = [...timestampsRef.current[type], now];
    saveTimestamps(type, timestampsRef.current[type]);

    return true;
  }, [checkRateLimit]);

  const getRemainingUsage = useCallback((type: RateLimitType): {
    remaining: number;
    total: number;
    resetsInSeconds: number;
  } => {
    let timestamps = initializeTimestamps(type);
    timestamps = cleanOldTimestamps(timestamps);

    const limit = RATE_LIMITS[type];
    const remaining = Math.max(0, limit - timestamps.length);

    // Find when the oldest timestamp will expire (when user gets one back)
    let resetsInSeconds = 0;
    if (timestamps.length > 0) {
      const oldestTimestamp = Math.min(...timestamps);
      const now = Date.now();
      resetsInSeconds = Math.max(0, Math.ceil(((oldestTimestamp + ONE_HOUR_MS) - now) / 1000));
    }

    return {
      remaining,
      total: limit,
      resetsInSeconds,
    };
  }, [initializeTimestamps]);

  return {
    checkRateLimit,
    recordUsage,
    getRemainingUsage,
    RATE_LIMITS,
  };
};
