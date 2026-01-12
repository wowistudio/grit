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

class ValidationError extends Error {
    constructor(message = 'Validation error') {
        super(message);
        this.name = 'ValidationError';
    }
}

describe('Grit - Retry Functionality', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Basic Retry Functionality', () => {
        it('should succeed on first attempt', async () => {
            const fn = vi.fn().mockResolvedValue('success');

            const result = await Grit.retry(3)
                .attempt(() => fn());

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it.only('should retry on failure and eventually succeed', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const result = await Grit.retry(3).attempt(fn);

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should throw error after max retries exhausted', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

            await expect(
                Grit.retry(3)
                    .attempt(async () => {
                        return await fn();
                    })
            ).rejects.toThrow('Always fails');

            expect(fn).toHaveBeenCalledTimes(4);
        });

        it('should pass attempt number to function', async () => {
            const attempts: number[] = [];
            const fn = vi.fn().mockImplementation(async (attempt: number) => {
                attempts.push(attempt);
                if (attempt < 3) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            await Grit.retry(3)
                .attempt(async (attempt) => {
                    return await fn(attempt);
                });

            expect(attempts).toEqual([1, 2, 3]);
        });
    });

    describe('Error Filtering - onlyErrors', () => {
        it('should retry only on specified errors', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new NetworkError();
                }
                return 'success';
            });

            const result = await Grit.retry(3)
                .onlyErrors([NetworkError])
                .attempt(async () => {
                    return await fn();
                });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should not retry on errors not in onlyErrors list', async () => {
            const fn = vi.fn().mockRejectedValue(new ValidationError());

            await expect(
                Grit.retry(3)
                    .onlyErrors([NetworkError, TimeoutError])
                    .attempt(async () => {
                        return await fn();
                    })
            ).rejects.toThrow(ValidationError);

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on multiple error types', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new NetworkError();
                } else if (attemptCount === 2) {
                    throw new TimeoutError();
                }
                return 'success';
            });

            const result = await Grit.retry(3)
                .onlyErrors([NetworkError, TimeoutError])
                .attempt(async () => {
                    return await fn();
                });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });

    describe('Error Filtering - skipErrors', () => {
        it('should retry on all errors except skipped ones', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new NetworkError();
                }
                return 'success';
            });

            const result = await Grit.retry(3)
                .skipErrors([ValidationError])
                .attempt(async () => {
                    return await fn();
                });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should not retry on skipped errors', async () => {
            const fn = vi.fn().mockRejectedValue(new ValidationError());

            await expect(
                Grit.retry(3)
                    .skipErrors([ValidationError])
                    .attempt(async () => {
                        return await fn();
                    })
            ).rejects.toThrow(ValidationError);

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('Edge Cases', () => {
        it('should handle non-Error objects thrown', async () => {
            const fn = vi.fn().mockRejectedValue('string error');

            await expect(
                Grit.retry(3)
                    .attempt(async () => {
                        return await fn();
                    })
            ).rejects.toBe('string error');

            expect(fn).toHaveBeenCalledTimes(4);
        });

        it('should handle null errors', async () => {
            const fn = vi.fn().mockRejectedValue(null);

            await expect(
                Grit.retry(3)
                    .attempt(async () => {
                        return await fn();
                    })
            ).rejects.toBeNull();

            expect(fn).toHaveBeenCalledTimes(4);
        });

        it('should work with zero retries (only one attempt)', async () => {
            const fn = vi.fn().mockResolvedValue('success');

            const result = await Grit.retry(0)
                .attempt(async () => {
                    return await fn();
                });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});
