import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GritError } from '../src/exceptions.ts';
import { Grit } from '../src/index.ts';

describe('Grit - Delay Configuration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Fixed Delay', () => {
        it('should wait fixed delay between retries', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;

                if (attemptCount < 2) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const promise = Grit.retry(2)
                .withDelay([200, 200])
                .attempt(async () => {
                    return await fn();
                });

            // Fast-forward time
            await vi.advanceTimersByTimeAsync(400);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should apply fixed delay on each retry', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const promise = Grit.retry(2)
                .withDelay({ delay: 100 })
                .attempt(async () => {
                    return await fn();
                });

            // Advance time for 2 retries (2 * 100ms = 200ms)
            await vi.advanceTimersByTimeAsync(200);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });

    describe('Exponential Backoff', () => {
        it('should apply exponential backoff with default factor 2', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 4) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const promise = Grit.retry(4)
                .withDelay({ delay: 100, factor: 2 })
                .attempt(async () => {
                    return await fn();
                });

            // First retry: 100ms, second: 200ms, third: 400ms = 700ms total
            await vi.advanceTimersByTimeAsync(700);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(4);
        });

        it('should apply exponential backoff with custom factor', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 4) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const promise = Grit.retry(4)
                .withDelay({ delay: 100, factor: 1.5 })
                .attempt(async () => {
                    return await fn();
                });

            // First retry: 100ms, second: 150ms, third: 225ms = 475ms total
            await vi.advanceTimersByTimeAsync(475);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(4);
        });
    });

    describe('Random Jitter', () => {
        it('should apply random delay within min/max range', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 2) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const promise = Grit.retry(1)
                .withDelay({ minDelay: 100, maxDelay: 200 })
                .attempt(async () => {
                    return await fn();
                });

            // Advance enough time for max delay
            await vi.advanceTimersByTimeAsync(200);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should apply random jitter with factor', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const promise = Grit.retry(3)
                .withDelay({ minDelay: 50, maxDelay: 100, factor: 2 })
                .attempt(async () => {
                    return await fn();
                });

            // Advance enough time for max delays with factor
            await vi.advanceTimersByTimeAsync(300);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });

    describe('Custom Array', () => {
        it('should use custom delay array', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                if (attemptCount <= 3) {
                    throw new Error('Failed');
                }
                return 'success';
            });

            const promise = Grit.retry(3)
                .withDelay([500, 1000, 2000])
                .attempt(async () => {
                    return await fn();
                });

            // Advance time for delays: 500ms + 1000ms = 1500ms
            await vi.advanceTimersByTimeAsync(3500);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(4);
        });

        it('should throw error if delay array length does not match retry count', () => {
            expect(() => {
                Grit.retry(3)
                    .withDelay([500, 1000]) // Only 2 delays for 3 retries
                    .attempt(() => { });
            }).toThrow(GritError);
        });
    });
});
