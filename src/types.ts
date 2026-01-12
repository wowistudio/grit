export type GritProps = {
    retryCount?: number;
    fn?: FunctionToExecute<any>;
    fallback?: FallbackFunction<any>;
    onlyErrors?: (typeof Error)[];
    skipErrors?: (typeof Error)[];
    delay?: DelayConfig;
    timeout?: TimeoutConfig;
    logging?: boolean;
}

export type TimeoutConfig =
    | number
    | { timeout: number; message?: string; signal?: AbortSignal; }

export type DelayConfig =
    | number
    | number[]
    | { factor?: number; delay: number; }
    | {
        factor?: number;
        minDelay: number;
        maxDelay: number;
    }

export type FunctionToExecute<T> = (attempts: number) => (Promise<T> | T)
export type FallbackFunction<T> = (error: unknown, attempts: number) => (Promise<T> | T)