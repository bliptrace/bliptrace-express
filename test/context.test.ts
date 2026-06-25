import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { contextFromRequest } from '../src/context.js';

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    url: '/orders/7',
    originalUrl: '/orders/7?ref=abc',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer secret-token',
      cookie: 'session=deadbeef',
      'user-agent': 'vitest',
    },
    ...overrides,
  } as unknown as Request;
}

describe('contextFromRequest', () => {
  it('yields method and url', () => {
    const ctx = contextFromRequest(fakeReq());
    const request = ctx.request as { method: string; url: string };
    expect(request.method).toBe('GET');
    expect(request.url).toBe('/orders/7?ref=abc');
  });

  it('strips authorization and cookie headers (case-insensitive)', () => {
    const ctx = contextFromRequest(
      fakeReq({
        headers: {
          Authorization: 'Bearer x',
          Cookie: 'a=b',
          'x-keep': 'yes',
        } as unknown as Request['headers'],
      }),
    );
    const headers = (ctx.request as { headers: Record<string, unknown> }).headers;
    expect(headers).not.toHaveProperty('Authorization');
    expect(headers).not.toHaveProperty('Cookie');
    expect(headers['x-keep']).toBe('yes');
  });

  it('removes lowercase authorization and cookie too', () => {
    const headers = (contextFromRequest(fakeReq()).request as { headers: Record<string, unknown> })
      .headers;
    expect(headers).not.toHaveProperty('authorization');
    expect(headers).not.toHaveProperty('cookie');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['user-agent']).toBe('vitest');
  });

  it('always provides an empty custom object', () => {
    expect(contextFromRequest(fakeReq()).custom).toEqual({});
  });

  it('includes user.id when req.user is present', () => {
    const ctx = contextFromRequest(fakeReq({ user: { id: '42', name: 'a' } } as unknown as Partial<Request>));
    expect((ctx.user as { id: unknown }).id).toBe('42');
  });

  it('omits user when req.user is absent', () => {
    expect(contextFromRequest(fakeReq()).user).toBeUndefined();
  });

  it('never throws on a malformed request', () => {
    expect(() => contextFromRequest(null as unknown as Request)).not.toThrow();
  });
});
