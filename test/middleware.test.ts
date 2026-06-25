import { Client, Config, type Envelope, type Transport } from '@g8scope/js';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { g8scopeErrorHandler } from '../src/index.js';

class FakeTransport implements Transport {
  sent: Array<{ endpoint: string; key: string; envelope: Envelope; timeout: number }> = [];
  send(endpoint: string, key: string, envelope: Envelope, timeout: number): void {
    this.sent.push({ endpoint, key, envelope, timeout });
  }
}

function fakeReq(): Request {
  return {
    method: 'POST',
    url: '/checkout',
    originalUrl: '/checkout',
    headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
  } as unknown as Request;
}

const res = {} as Response;

describe('g8scopeErrorHandler', () => {
  it('builds and ships a valid envelope for a thrown Error and calls next(err)', async () => {
    const t = new FakeTransport();
    const client = new Client(new Config({ key: 'k', endpoint: 'http://api' }), t);
    const handler = g8scopeErrorHandler({ client });

    const next = vi.fn();
    const err = new Error('checkout failed');
    handler(err, fakeReq(), res, next as unknown as NextFunction);

    // next(err) is synchronous and must always fire with the original error.
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(err);

    // The send is fire-and-forget; let the microtask queue drain.
    await Promise.resolve();
    await Promise.resolve();

    expect(t.sent).toHaveLength(1);
    const env = t.sent[0].envelope;
    expect(env.runtime.name).toBe('javascript');
    expect(env.sdk).toBeDefined();
    expect(env.sdk?.name).toBe('g8scope-js');
    expect(env.exception.type).toBe('Error');
    expect(env.exception.message).toBe('checkout failed');

    const request = env.context?.request as { method: string; url: string; headers: Record<string, unknown> };
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/checkout');
    expect(request.headers).not.toHaveProperty('authorization');
  });

  it('accepts a transport instead of a full client', async () => {
    const t = new FakeTransport();
    const handler = g8scopeErrorHandler({ key: 'k', transport: t });
    const next = vi.fn();

    handler(new TypeError('boom'), fakeReq(), res, next as unknown as NextFunction);
    await Promise.resolve();
    await Promise.resolve();

    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].envelope.exception.type).toBe('TypeError');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sends nothing when no key is configured but still calls next', async () => {
    const t = new FakeTransport();
    const handler = g8scopeErrorHandler({ transport: t });
    const next = vi.fn();

    handler(new Error('x'), fakeReq(), res, next as unknown as NextFunction);
    await Promise.resolve();

    expect(t.sent).toHaveLength(0);
    expect(next).toHaveBeenCalledOnce();
  });

  it('sends nothing when disabled', async () => {
    const t = new FakeTransport();
    const handler = g8scopeErrorHandler({ key: 'k', enabled: false, transport: t });
    const next = vi.fn();

    handler(new Error('x'), fakeReq(), res, next as unknown as NextFunction);
    await Promise.resolve();

    expect(t.sent).toHaveLength(0);
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not ship non-Error values but still forwards them', async () => {
    const t = new FakeTransport();
    const handler = g8scopeErrorHandler({ key: 'k', transport: t });
    const next = vi.fn();

    const weird = 'a string was thrown';
    handler(weird, fakeReq(), res, next as unknown as NextFunction);
    await Promise.resolve();

    expect(t.sent).toHaveLength(0);
    expect(next).toHaveBeenCalledWith(weird);
  });

  it('never throws even if the transport explodes, and still calls next', () => {
    const exploding: Transport = {
      send() {
        throw new Error('transport down');
      },
    };
    const handler = g8scopeErrorHandler({ key: 'k', transport: exploding });
    const next = vi.fn();

    const err = new Error('x');
    expect(() => handler(err, fakeReq(), res, next as unknown as NextFunction)).not.toThrow();
    expect(next).toHaveBeenCalledWith(err);
  });
});
