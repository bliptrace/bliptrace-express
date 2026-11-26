# @bliptrace/express

Express framework adapter for [Bliptrace](https://scope.g8suite.com). A **thin** error-handling
middleware over the runtime SDK [`@bliptrace/js`](../bliptrace-js): it captures unhandled errors,
enriches them with request context, and ships them to the Bliptrace ingest API.

It is designed never to throw into your app. Capture is fire-and-forget, so a slow or
unavailable ingest API never delays your response, and the original error always flows on to
your own error handling.

> The **project is resolved server-side from the ingest key** — it is never part of the
> payload. You only ever configure a `key`; Bliptrace maps it to the right project.

## Install

```bash
npm install @bliptrace/express
```

`@bliptrace/js` is a dependency and is installed automatically.

## Usage

Register `bliptraceErrorHandler` as the **last** middleware, after all routes and any other
error handlers you want to run first:

```ts
import express from 'express';
import { bliptraceErrorHandler } from '@bliptrace/express';

const app = express();

// ... your routes ...

// Must be last.
app.use(bliptraceErrorHandler({ key: process.env.BLIPTRACE_KEY }));
```

When an error reaches the middleware it builds an envelope (with request context), ships it
without blocking, and then calls `next(err)` so Express continues to your own error handling.

## Options

All [`@bliptrace/js` `ConfigOptions`](../bliptrace-js) are accepted, plus two adapter-only escape
hatches for testing and advanced wiring:

| Option | Type | Notes |
|---|---|---|
| `key` | `string` | Ingest key. The server resolves the project from this. |
| `endpoint` | `string` | Ingest API base URL. Defaults to the Bliptrace production endpoint. |
| `environment` | `string` | e.g. `production`, `staging`. |
| `release` | `string` | Release identifier for the running build. |
| `timeout` | `number` | Send timeout in milliseconds. |
| `ignoreExceptions` | `string[]` | Error class names to skip. |
| `scrubKeys` | `string[]` | Context keys to redact before sending. |
| `basePath` | `string` | Marks frames under this path as in-app. |
| `enabled` | `boolean` | Set `false` to disable capture entirely. |
| `client` | `Client` | Inject a pre-built `@bliptrace/js` client (e.g. with a fake transport in tests). |
| `transport` | `Transport` | Inject a transport for the internally-built client. |

## Request context

Each capture is enriched from the Express request:

- `request.method` and `request.url`
- `request.headers` — with `authorization` and `cookie` removed
- `user.id` — when an auth layer has attached `req.user`

## Exports

```ts
import {
  bliptraceErrorHandler, // the Express error middleware factory
  bliptraceMiddleware,   // alias of bliptraceErrorHandler
  init,                  // alias of bliptraceErrorHandler
  contextFromRequest,    // build context from a request, on its own
  Client,                // re-exported from @bliptrace/js
  Config,                // re-exported from @bliptrace/js
} from '@bliptrace/express';
```

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Licence

MIT © Developers Hub Sdn Bhd
