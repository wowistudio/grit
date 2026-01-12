# Grit

> ⚠️ **Work in Progress**: This library is currently under active development. The API may change and some features may be incomplete.

Grit is a library for retries with error filtering and backoff strategies (fixed, exponential, random jitter)

## Installation

```bash
# Using npm
npm install @wowistudio/grit
# Using pnpm
pnpm add @wowistudio/grit
# Using yarn
yarn add @wowistudio/grit
```

## Usage Examples

### Retry

Retry an operation a specified numbers of times. The total attempts will be 1 + n retries.

```typescript
import { Grit } from '@wowistudio/grit';

class ValidationError extends Error {}
class NetworkError extends Error {}
class TimeoutError extends Error {}

// Basic
const result = await Grit.retry(3)
  .attempt(fetchData);

console.log(result)

// Basic with access to attempt count
await Grit.retry(3)
  .attempt((attemptCount) => {
    console.log('Attempt:', attemptCount)
    return apiCall()
  })

// Retry only specific errors
await Grit.retry(5)
  .onlyErrors([NetworkError, TimeoutError])
  .attempt(() => makeNetworkRequest);

// Do not retry specific errors
await Grit.retry(3)
  .skipErrors([ValidationError])
  .attempt(apiCall);
```

### Delay

```typescript
import { Grit } from '@wowistudio/grit';

// Delay with fixed intervals (in ms)
await Grit.retry(3)
  .withDelay(1000)
  .attempt(apiCall);

// Delay with exponential backoff
// This setup generates delay: [2000, 4000, 8000]
await Grit.retry(3)
  .withDelay({ 
    delay: 2000, 
    factor: 2
  })
  .attempt(apiCall);

// Delay with randomness
await Grit.retry(4)
  .withDelay({
    minDelay: 3000, 
    maxDelay: 4000,
  })
  .attempt(apiCall);

// Delay with exact delays for each retry
await Grit.retry(3)
  .withDelay([500, 1000, 1500])
  .attempt(apiCall);
```

### Timeout

> ⚠️ **Note**: the execution of operation is not stopped after timeout. The process will stop waiting for the code execution finish after the specified duration, but the original operation may continue running in the background.

```typescript
import { Grit } from '@wowistudio/grit';

// Operation timeout after specified amount of time
await Grit.retry(3)
  .withTimeout(5000)
  .attempt(apiCall);

// Custom timeout error message
await Grit.retry(3)
  .withTimeout({ timeout: 5000, message: 'Request timed out after 5 seconds' })
  .attempt(apiCall);

// With abort controller signal
const controller = new AbortController();
Grit.retry(3)
  .withTimeout({ timeout: 5000, signal: controller.signal })
  .attempt(apiCall);

controller.abort() // abort somewhere else to timeout immediately and not retry
```

### Fallback

```typescript
import { Grit } from '@wowistudio/grit';

const fastCacheLookup = async () => {}
const slowerDbFetch = async () => {}

// Attempt with fallback
await Grit.retry(0)
  .withTimeout(100)
  .fallback(slowerDbFetch)
  .attempt(fastCacheLookup)

// Access the error within fallback
const result = await Grit.retry(0)
    .withTimeout(5000)
    .withFallback(async (error, attempts) => {
        console.log(`Failed after ${attempts} attempts with error: ${error.message}`);
        return slowerDbFetch()
    })
    .attempt(fastCacheLookup);

// Attempt return type is typesafe when adding a fallback
const result = await Grit.retry(0) // will be of type (number | string)
  .withTimeout(100)
  .withFallback(() => 1)
  .attempt(() => 'a')
```
### Safe Attempt

```typescript
// Attempt and return result & error
const answer = await Grit.retry(1)
    .safeAttempt(() => {
      throw new Error('whoops')
    }); 

console.log(answer) // { result: null, error: Error('whoops') }
```

## Reusable Builder Instances

You can define a builder instance once and reuse it. Each call to `.attempt()` creates a new execution context, so retry state is independent between calls:

```typescript
import { Grit } from '@wowistudio/grit';

// Define a shared builder configuration
const grit = Grit.retry(3)
  .withDelay(2000)
  .withTimeout(5000)
  .onlyErrors([NetworkError])

// Use the same builder for multiple different operations
const userData = await grit.attempt(fetchUserData);
const orderData = await grit.attempt(fetchOrderData);
```

## License

This project is licensed under the MIT License.

