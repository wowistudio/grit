import { GritError } from "./exceptions.js";
import { Grit } from "./grit.js";
import type { TimeoutConfig } from "./types.js";

export const isObject = (o: any): o is Record<string, any> => {
    return typeof o === 'object' && !Array.isArray(o) && o !== null;
}

export const isPromise = <T>(value: any): value is Promise<T> => {
    return value !== null && typeof value === "object" && typeof value.then === "function";
}

export const validateGritConfig = (grit: Grit<any>) => {
    const { retryCount, delay: delayConfig, timeout: timeoutConfig } = grit;

    if (retryCount !== 0 && !retryCount)
        throw new GritError("Missing retry config (Grit.retry(<count>))");

    if (delayConfig) {
        if (typeof delayConfig === "number") {
            if (delayConfig < 0)
                throw new GritError("delay must be greater than 0");
            return;
        }

        // validate array config
        if (Array.isArray(delayConfig)) {
            if (delayConfig.length !== retryCount)
                throw new GritError("Delay array length must be equal to retry count");
            for (const delay of delayConfig) {
                if (delay <= 0)
                    throw new GritError("delay must be greater than 0");
            }
            return;
        }

        if (!isObject(delayConfig))
            throw new GritError("Invalid backoff config");

        // validate delay config
        if ("delay" in delayConfig) {
            if (typeof delayConfig.delay !== "number")
                throw new GritError("delay must be a number");
            if (delayConfig.delay <= 0)
                throw new GritError("delay must be greater than 0");
            return;
        }

        // validate random delay config
        const { minDelay, maxDelay } = delayConfig;
        if (!minDelay || typeof minDelay !== "number")
            throw new GritError("minDelay must be a number");
        if (!maxDelay || typeof maxDelay !== "number")
            throw new GritError("maxDelay must be a number");
        if (minDelay >= maxDelay)
            throw new GritError("minDelay must be less than maxDelay");
        if (minDelay <= 0)
            throw new GritError("minDelay must be greater than 0");
        if (maxDelay <= 0)
            throw new GritError("maxDelay must be greater than 0");
    }

    if (timeoutConfig) {
        if (typeof timeoutConfig === "number") {
            if (timeoutConfig <= 0)
                throw new GritError("timeout must be greater than 0");
            if (timeoutConfig === Number.POSITIVE_INFINITY)
                throw new GritError("timeout cannot be infinity");
            return;
        }

        if (!isObject(timeoutConfig))
            throw new GritError("Invalid timeout config");

        if ("timeout" in timeoutConfig) {
            if (typeof timeoutConfig.timeout !== "number")
                throw new GritError("timeout must be a number");
            if (timeoutConfig.timeout === Number.POSITIVE_INFINITY)
                throw new GritError("timeout cannot be infinity");
            if (timeoutConfig.timeout <= 0)
                throw new GritError("timeout must be greater than 0");
        }
    }
}

export const getTimeoutConfig = (config: TimeoutConfig | undefined): { timeout: number; message: string; signal?: AbortSignal; } => {
    if (typeof config === "number") {
        return {
            timeout: config,
            signal: undefined,
            message: "Promise timed out after " + config + " milliseconds"
        };
    } else if (typeof config === "object") {
        const { timeout, signal, message } = config;
        return {
            timeout,
            signal,
            message: message || "Promise timed out after " + timeout + " milliseconds"
        };
    }
    throw new GritError("Invalid timeout config");
}