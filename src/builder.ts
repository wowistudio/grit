import { GritError } from "./exceptions.js";
import { Grit } from "./grit.js";
import type { DelayConfig, FallbackFunction, FunctionToExecute, TimeoutConfig } from "./types.js";

class GritBuilder<FallbackType = never> {
    private retryCount?: number;
    _onlyErrors: (typeof GritError)[] = [];
    _skipErrors: (typeof GritError)[] = [];
    fn: FunctionToExecute<any> | undefined = undefined;
    $delay: DelayConfig | undefined;
    $timeout: TimeoutConfig | undefined;
    $fallback: FallbackFunction<FallbackType> | undefined;
    logging: boolean = false;


    constructor(retryCount: number) {
        this.retryCount = retryCount;
    }

    onlyErrors(errors: (typeof GritError)[]) {
        this._onlyErrors = errors;
        return this;
    }

    skipErrors(errors: (typeof GritError)[]) {
        this._skipErrors = errors;
        return this;
    }

    withLogging(enabled: boolean = true) {
        this.logging = enabled;
        return this;
    }

    withDelay(config: DelayConfig) {
        this.$delay = config;
        return this;
    }

    withTimeout(timeout: TimeoutConfig) {
        this.$timeout = timeout;
        return this;
    }

    #build<T>(): Grit<T> {
        return new Grit<T>({
            retryCount: this.retryCount,
            onlyErrors: this._onlyErrors as (typeof Error)[],
            skipErrors: this._skipErrors as (typeof Error)[],
            delay: this.$delay,
            timeout: this.$timeout,
            logging: this.logging,
            fallback: this.$fallback,
        });
    }

    withFallback<T>(fallback: FallbackFunction<T>): GritBuilder<T> {
        const newBuilder = this as unknown as GritBuilder<T>;
        newBuilder.$fallback = fallback;
        return newBuilder;
    }

    attempt<T = FallbackType>(
        fn: FunctionToExecute<T>
    ): Promise<FallbackType extends never ? T : T | FallbackType> {
        return this.#build<FallbackType extends never ? T : T | FallbackType>().attempt(
            fn as FunctionToExecute<FallbackType extends never ? T : T | FallbackType>
        ) as Promise<FallbackType extends never ? T : T | FallbackType>;
    }

    safeAttempt<T = FallbackType>(
        fn: FunctionToExecute<T>
    ): Promise<{ result: (FallbackType extends never ? T : T | FallbackType) | null; error: unknown | null }> {
        return this.#build<FallbackType extends never ? T : T | FallbackType>().safeAttempt(
            fn as FunctionToExecute<FallbackType extends never ? T : T | FallbackType>
        ) as Promise<{ result: (FallbackType extends never ? T : T | FallbackType) | null; error: unknown | null }>;
    }
}

export { GritBuilder };
