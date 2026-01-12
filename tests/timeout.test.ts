import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError } from '../src/exceptions.ts';
import { Grit } from '../src/index.ts';

describe('Grit - Timeout Functionality', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('withTimeout(500) - Simple number timeout', () => {
        it('should succeed if function completes before timeout', async () => {
            const fn = vi.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return 'success';
            });

            const promise = Grit.retry(1)
                .withTimeout(500)
                .attempt(() => fn());

            // Fast-forward time to allow function to complete
            await vi.advanceTimersByTimeAsync(100);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('withTimeout({ timeout: 500, message: "Custom message" }) - Custom message', () => {
        it('should succeed if function completes before timeout', async () => {
            const fn = vi.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return 'success';
            });

            const promise = Grit.retry(1)
                .withTimeout({ timeout: 500, message: 'Custom message' })
                .attempt(() => fn());

            await vi.advanceTimersByTimeAsync(100);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('withTimeout({ timeout: 500, signal: AbortController().signal }) - Abort signal', () => {
        it('should succeed if function completes before timeout', async () => {
            const fn = vi.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return 'success';
            });

            const abortController = new AbortController();
            const promise = Grit.retry(1)
                .withTimeout({ timeout: 500, signal: abortController.signal })
                .attempt(() => fn());

            await vi.advanceTimersByTimeAsync(100);
            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it.only('should handle already aborted signal', async () => {
            const fn = vi.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return 'success';
            });

            const abortController = new AbortController();
            abortController.abort(); // Abort before creating the promise

            const promise = Grit.retry(1)
                .withTimeout({ timeout: 500, signal: abortController.signal })
                .attempt(fn);

            await expect(promise).rejects.toThrow();
            expect(fn).not.toHaveBeenCalled();
        });
    });

    describe('Timeout with retries', () => {
        it('should timeout on each retry attempt', async () => {
            let attemptCount = 0;
            const fn = vi.fn().mockImplementation(async () => {
                attemptCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                return 'success';
            });

            const promise = Grit.retry(2)
                .withTimeout(500)
                .attempt(() => fn());

            // Fast-forward past first timeout
            await vi.advanceTimersByTimeAsync(500);
            // Fast-forward past second timeout
            await vi.advanceTimersByTimeAsync(500);
            // Fast-forward past third timeout
            await vi.advanceTimersByTimeAsync(500);

            await expect(promise).rejects.toThrow(TimeoutError);
            // Should have attempted 3 times (initial + 2 retries)
            expect(fn).toHaveBeenCalledTimes(3);
        });
    });

    describe('Edge cases', () => {
        it('should handle synchronous function with timeout', async () => {
            const fn = vi.fn().mockReturnValue('success');

            const promise = Grit.retry(1)
                .withTimeout(500)
                .attempt(() => fn());

            const result = await promise;

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should handle timeout with fallback', async () => {
            const fn = vi.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return 'success';
            });

            const fallback = vi.fn().mockReturnValue('fallback');

            const promise = Grit.retry(1)
                .withTimeout(500)
                .withFallback(fallback)
                .attempt(() => fn());

            await vi.advanceTimersByTimeAsync(500);

            const result = await promise;

            expect(result).toBe('fallback');
            expect(fallback).toHaveBeenCalled();
        });
    });
});
