import { GritBuilder } from "./builder.js";
import { GritError, TimeoutError } from "./exceptions.js";
import type { DelayConfig, FallbackFunction, FunctionToExecute, GritProps, TimeoutConfig } from "./types.js";
import { getTimeoutConfig, isObject, validateGritConfig } from "./utils.js";

const getAbortedReason = (signal: AbortSignal) => signal.reason ?? new DOMException('This operation was aborted.', 'AbortError');


class Grit<T> {
    readonly retryCount?: number;
    private attempts: number = 1;
    private retries: number = 0;
    private onlyErrors: (typeof Error)[];
    private skipErrors: (typeof Error)[];
    readonly delay: DelayConfig | undefined;
    private fallback: FallbackFunction<T> | undefined;
    readonly timeout: TimeoutConfig | undefined;
    private logging: boolean = false;


    constructor(props: GritProps) {
        const { retryCount, onlyErrors, skipErrors, delay, timeout, logging, fallback } = props;
        this.retryCount = retryCount;
        this.onlyErrors = onlyErrors || [];
        this.skipErrors = skipErrors || [];
        this.delay = delay;
        this.fallback = fallback;
        this.timeout = timeout;
        this.logging = logging || false;

        validateGritConfig(this);
    }

    get #currentDelay() {
        let delay: number | undefined = undefined;
        if (typeof this.delay === "number") {
            delay = this.delay;
        } else if (Array.isArray(this.delay)) {
            delay = this.delay.shift();
        } else if (isObject(this.delay) && "delay" in this.delay) {
            const { factor, delay: initialDelay } = this.delay;
            delay = initialDelay * Math.pow(factor || 1, this.attempts - 2);
        } else if (isObject(this.delay) && "minDelay" in this.delay) {
            const { minDelay, maxDelay, factor } = this.delay;
            const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;
            delay = factor ? randomDelay * Math.pow(factor, this.attempts - 2) : randomDelay;
        }
        if (!delay)
            throw new GritError("No delay. Should never happen.");

        if (this.logging)
            console.debug("Delaying for", delay, "ms");

        return delay;
    }

    async #backoff() {
        return new Promise((resolve) => setTimeout(resolve, this.#currentDelay))
    }

    #withTimeout(fn: FunctionToExecute<T>): Promise<T> & { abort: AbortController['abort'] } {
        let timer: ReturnType<typeof setTimeout> | undefined = undefined;
        let abortHandler: () => void = () => { };

        const { timeout, message, signal } = getTimeoutConfig(this.timeout);

        const timeoutController = new AbortController();

        let wrappedPromise = new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(getAbortedReason(signal))
                return;
            }

            if (signal) {
                abortHandler = () => {
                    reject(getAbortedReason(signal));
                };
                signal.addEventListener('abort', abortHandler, { once: true });
            }

            Promise.resolve(fn(this.attempts)).then(resolve, reject);

            const timeoutError = new TimeoutError(message);
            timeoutController.signal.addEventListener('abort', () => reject(timeoutError));
            timer = setTimeout(() => timeoutController.abort(), timeout);
        }) as Promise<T> & { abort: AbortController['abort'] };

        wrappedPromise = wrappedPromise.finally(() => {
            clearTimeout(timer);
            timer = undefined;
        }) as Promise<T> & { abort: AbortController['abort'] };

        wrappedPromise.abort = timeoutController.abort;
        return wrappedPromise as Promise<T> & { abort: AbortController['abort'] };
    }

    async #execute(fn: FunctionToExecute<T>): Promise<T> {
        try {
            if (this.timeout)
                return await this.#withTimeout(fn);
            return await fn(this.attempts);
        } catch (error) {
            if (this.retries >= this.retryCount!) {
                if (this.fallback)
                    return this.fallback(error, this.attempts);
                throw error;
            }

            if (error && typeof error === 'object' && 'constructor' in error) {
                if (this.skipErrors.length > 0 && this.skipErrors.includes(error.constructor as typeof Error))
                    throw error;

                if (this.onlyErrors.length > 0 && !this.onlyErrors.includes(error.constructor as typeof Error))
                    throw error;
            }

            this.attempts++;
            this.retries++;

            if (this.delay)
                return this.#backoff().then(() => this.#execute(fn));
            return await this.#execute(fn);
        }
    }

    async attempt(fn: FunctionToExecute<T>): Promise<T> {
        return this.#execute(fn);
    }

    async safeAttempt(fn: FunctionToExecute<T>): Promise<{ result: T | null; error: unknown | null }> {
        try {
            const result = await this.#execute(fn);
            return { result, error: null };
        } catch (error) {
            return { error, result: null };
        }
    }

    static retry(retryCount: number) {
        return new GritBuilder(retryCount);
    }
}

export { Grit };

