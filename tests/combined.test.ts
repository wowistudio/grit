import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Grit } from '../src/index.ts';

// Custom error classes for testing
class NetworkError extends Error {
    constructor(message = 'Network error') {
        super(message);
        this.name = 'NetworkError';
    }
}

class TimeoutError extends Error {
    constructor(message = 'Timeout error') {
        super(message);
        this.name = 'TimeoutError';
    }
}

describe('Grit - Integration Tests', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Combined Features', () => {
        it('should combine multiple features correctly', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new NetworkError();
                }
                return 'success';
            });

            const promise = Grit.retry(5)
                .onlyErrors([NetworkError, TimeoutError])
                .withDelay({ delay: 100, factor: 2 })
                .attempt(async (attempt) => {
                    return await fn(attempt);
                });

            // Advance time for exponential backoff: 100ms + 200ms = 300ms
            await vi.advanceTimersByTimeAsync(300);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });
});
