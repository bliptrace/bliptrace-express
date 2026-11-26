import type { Context } from '@bliptrace/js';
import type { Request } from 'express';

/** Header names stripped from every capture — they carry credentials. */
const SENSITIVE_HEADERS = ['authorization', 'cookie'];

/**
 * Build the envelope context from an Express request.
 *
 * Returns `{ request, user?, custom }`:
 * - `request.headers` has `authorization` and `cookie` removed (case-insensitive).
 * - `user` is populated from `req.user?.id` when an auth layer has attached it.
 * - `custom` is always present (the runtime SDK expects it) and starts empty.
 *
 * Never throws — a malformed request degrades to an empty context.
 */
export function contextFromRequest(req: Request): Context {
  try {
    const context: Context = {
      request: {
        method: req.method,
        url: requestUrl(req),
        headers: safeHeaders(req.headers),
      },
      custom: {},
    };

    const userId = userIdFrom(req);
    if (userId !== undefined) {
      context.user = { id: userId };
    }

    return context;
  } catch {
    // Context enrichment must never break a capture.
    return { request: {}, custom: {} };
  }
}

/** Best-effort absolute-ish URL: prefer originalUrl, fall back to url. */
function requestUrl(req: Request): string {
  return (req.originalUrl ?? req.url ?? '') || '';
}

/** Copy headers, dropping any whose lowercased name is sensitive. */
function safeHeaders(headers: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(name.toLowerCase())) continue;
    out[name] = value;
  }
  return out;
}

/** Pull a user id off `req.user` if an auth middleware attached one. */
function userIdFrom(req: Request): unknown {
  const user = (req as Request & { user?: { id?: unknown } }).user;
  if (user && typeof user === 'object' && user.id !== undefined && user.id !== null) {
    return user.id;
  }
  return undefined;
}
