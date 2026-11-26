import { Client, Config, type ConfigOptions, type Transport } from '@bliptrace/js';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { contextFromRequest } from './context.js';

export { contextFromRequest } from './context.js';
export { Client, Config } from '@bliptrace/js';
export type { ConfigOptions, Transport } from '@bliptrace/js';

/**
 * Options for the Express adapter. These are the runtime SDK's {@link ConfigOptions}
 * plus two adapter-only escape hatches for testing and advanced wiring.
 *
 * Remember: the project is resolved server-side from the ingest `key`. It is never
 * part of the payload and there is no `project` option here.
 */
export interface BliptraceExpressOptions extends ConfigOptions {
  /** Inject a pre-built client (e.g. with a fake transport in tests). Wins over everything else. */
  client?: Client;
  /** Inject a transport for the internally-built client (e.g. a recording fake in tests). */
  transport?: Transport;
}

/** Resolve a {@link Client} from adapter options, honouring an injected client/transport. */
function resolveClient(options: BliptraceExpressOptions = {}): Client {
  if (options.client) return options.client;
  const { client: _client, transport, ...configOptions } = options;
  return new Client(new Config(configOptions), transport);
}

/**
 * Build an Express error-handling middleware that captures the error with request
 * context and ships it to Bliptrace, then hands control back to your own error handling.
 *
 * Register it as the LAST middleware:
 *
 * ```ts
 * app.use(bliptraceErrorHandler({ key: process.env.BLIPTRACE_KEY }));
 * ```
 *
 * The capture is fire-and-forget — it runs after the framework continues the chain,
 * so a slow or down ingest API never delays your response. Capture is fully guarded:
 * any failure here is swallowed and the original error still flows to `next(err)`.
 */
export function bliptraceErrorHandler(options: BliptraceExpressOptions = {}): ErrorRequestHandler {
  let client: Client | null = null;
  try {
    client = resolveClient(options);
  } catch {
    client = null; // a bad config must never stop the app from starting
  }

  return (err: unknown, req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (client && err instanceof Error) {
        // Fire-and-forget: do not await, do not let a rejection escape.
        Promise.resolve(client.capture(err, contextFromRequest(req))).catch(() => {});
      }
    } catch {
      // Capturing must never break the request.
    }
    // Always let the host app's own error handling continue.
    next(err);
  };
}

/** Alias for {@link bliptraceErrorHandler}. */
export const bliptraceMiddleware = bliptraceErrorHandler;

/** Alias for {@link bliptraceErrorHandler}. */
export const init = bliptraceErrorHandler;
