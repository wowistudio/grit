import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GritError } from '../src/exceptions.ts';
import { Grit } from '../src/index.ts';


class NetworkError extends Error {
    constructor(message = 'Network error') {
        super(message);
        this.name = 'NetworkError';
    }
}

class ValidationError extends Error {
    constructor(message = 'Validation error') {
        super(message);
        this.name = 'ValidationError';
    }
}

describe('Grit - Builder Pattern', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('GritBuilder', () => {
        it('should allow immediate execution via attempt on builder', async () => {
            const fn = vi.fn().mockResolvedValue('success');

            const result = await Grit.retry(3)
                .attempt(async () => {
                    return await fn();
                });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should allow reusing builder instance with multiple isolated attempts', async () => {
            // Create a builder instance with shared configuration
            const builder = Grit.retry(3)
                .onlyErrors([NetworkError])
                .withDelay({ delay: 100 })

            // Track calls to verify isolation
            const fn1 = vi.fn().mockResolvedValue('result1');
            const fn2 = vi.fn().mockResolvedValue('result2');
            const fn3 = vi.fn().mockResolvedValue('result3');

            // Call attempt multiple times with different functions
            const result1 = await builder.attempt(async () => {
                return await fn1();
            });

            const result2 = await builder.attempt(async () => {
                return await fn2();
            });

            const result3 = await builder.attempt(async () => {
                return await fn3();
            });

            // Verify each execution is isolated and successful
            expect(result1).toBe('result1');
            expect(result2).toBe('result2');
            expect(result3).toBe('result3');

            // Each function should be called exactly once (no interference)
            expect(fn1).toHaveBeenCalledTimes(1);
            expect(fn2).toHaveBeenCalledTimes(1);
            expect(fn3).toHaveBeenCalledTimes(1);
        });

        it('should maintain isolation when builder attempts fail and retry', async () => {
            const builder = Grit.retry(2)
                .onlyErrors([NetworkError])

            let attempt1Count = 0;
            let attempt2Count = 0;

            // First attempt that fails once then succeeds
            const result1 = await builder.attempt(() => {
                attempt1Count++;
                if (attempt1Count === 1) {
                    throw new NetworkError('First attempt failed');
                }
                return 'success1';
            });

            // Second attempt that also fails once then succeeds
            const result2 = await builder.attempt(() => {
                attempt2Count++;
                if (attempt2Count === 1) {
                    throw new NetworkError('Second attempt failed');
                }
                return 'success2';
            });


            // Verify both succeeded after retries
            expect(result1).toBe('success1');
            expect(result2).toBe('success2');

            // Verify retry counts are isolated (each should retry once)
            expect(attempt1Count).toBe(2);
            expect(attempt2Count).toBe(2);
        });
    });

    describe('Error Handling', () => {
        it('should throw GritError for invalid delay array length', () => {
            expect(() => {
                Grit.retry(3)
                    .withDelay([100, 200]) // Wrong length
                    .attempt(() => { });
            }).toThrow(GritError);
        });

        it('should throw GritError for negative delay', () => {
            expect(() => {
                Grit.retry(3)
                    .withDelay([-100, 200, 300])
                    .attempt(() => { });
            }).toThrow(GritError);
        });

        it('should throw GritError for invalid delay config', () => {
            expect(() => {
                Grit.retry(3)
                    .withDelay({ delay: -100 } as any)
                    .attempt(() => { });
            }).toThrow(GritError);
        });

        it('should throw GritError for invalid random delay config', () => {
            expect(() => {
                Grit.retry(3)
                    .withDelay({ minDelay: 200, maxDelay: 100 } as any) // minDelay > maxDelay
                    .attempt(() => { });
            }).toThrow(GritError);
        });

        it('should throw GritError for zero delay', () => {
            expect(() => {
                Grit.retry(3)
                    .withDelay({ delay: 0 })
                    .attempt(() => { });
            }).toThrow(GritError);
        });
    });
});
