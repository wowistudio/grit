class GritError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GritError";
    }
}

class MaxRetriesError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MaxRetriesError";
    }
}

export class TimeoutError extends Error {
    name = 'TimeoutError';

    constructor(message: string) {
        super(message);
        this.name = "TimeoutError";
    }
}


export { GritError, MaxRetriesError };
