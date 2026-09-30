import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { DOT_BODY_LIMIT } from '@aihot/contracts/dot-ingest';
import { DotIntakeError, DotIntakeService } from '@aihot/backend/ingest/dot';

interface DotRouteOptions { service?: DotIntakeService; env?: () => NodeJS.ProcessEnv }
const placeholder = /(changeme|change-me|placeholder|your[-_]?token|example|todo|replace[-_]?with)/i;
function authorized(header: string | undefined, expected: string | undefined): boolean {
  if (!expected || expected.length < 32 || expected.length > 256 || expected.trim() !== expected || placeholder.test(expected)
    || /^(.)\1+$/.test(expected) || /^(test|dev)([-_]|token|$)|^xxx+$/i.test(expected)) return false;
  const given = /^Bearer ([^\s]+)$/i.exec(header ?? '')?.[1] ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
// Counted before authentication so token guessing and bulk retries are both bounded: a per-address cap
// plus an overall cap that still holds when a client forges its address (trustProxy takes the
// client-controlled X-Forwarded-For). The overall window lives outside the address map, so clearing the
// map when forged addresses flood it never resets the overall count. Once over a limit, no more
// timestamps are kept, so a window holds at most limit + 1 entries. State lives with the app instance.
export const DOT_RATE_LIMIT = { perAddress: 60, overall: 300, windowMs: 60_000, maxAddresses: 5000 };
function rateLimiter() {
  const byAddress = new Map<string, number[]>();
  let overall: number[] = [];
  const over = (list: number[], limit: number, now: number): number[] => {
    const live = list.filter((t) => now - t < DOT_RATE_LIMIT.windowMs);
    if (live.length <= limit) live.push(now);
    return live;
  };
  return (address: string, now = Date.now()): boolean => {
    if (byAddress.size > DOT_RATE_LIMIT.maxAddresses) byAddress.clear();
    const mine = over(byAddress.get(address) ?? [], DOT_RATE_LIMIT.perAddress, now);
    byAddress.set(address, mine);
    overall = over(overall, DOT_RATE_LIMIT.overall, now);
    return overall.length > DOT_RATE_LIMIT.overall || mine.length > DOT_RATE_LIMIT.perAddress;
  };
}
export function registerDotIngest(app: FastifyInstance, options: DotRouteOptions = {}) {
  const env = options.env ?? (() => process.env);
  const rateLimited = rateLimiter();
  let service = options.service;
  app.post('/api/ingest/dot', {
    bodyLimit: DOT_BODY_LIMIT,
    onRequest: async (req, reply) => {
      reply.header('Cache-Control', 'no-store');
      const settings = env();
      if (settings.DOT_INGEST_ENABLED !== 'true') return reply.code(503).send({ ok: false, error: 'dot_ingest_disabled' });
      if (rateLimited(String(req.ip))) return reply.header('Retry-After', String(DOT_RATE_LIMIT.windowMs / 1000)).code(429).send({ ok: false, error: 'rate_limited' });
      if (!authorized(req.headers.authorization, settings.DOT_INGEST_TOKEN)) return reply.code(401).send({ ok: false, error: 'unauthorized' });
    },
    // Parser errors are stable, private, and never log received text or credentials.
    errorHandler: (error, _req, reply) => {
      const status = (error as { statusCode?: number }).statusCode;
      return reply.header('Cache-Control', 'no-store').code(status === 413 ? 413 : status === 415 ? 415 : 400)
        .send({ ok: false, error: status === 413 ? 'payload_too_large' : 'invalid_request' });
    },
  }, async (req, reply) => {
    try {
      if (!service) {
        const { PostgresDotRepository } = await import('@aihot/backend/ingest/dot-repository');
        service = new DotIntakeService(new PostgresDotRepository());
      }
      return await service.receive(req.body);
    } catch (error) {
      if (error instanceof DotIntakeError) return reply.code(error.status).send({ ok: false, error: error.code });
      // Only the code is returned; errors can contain source data or DB connection secrets.
      return reply.code(503).send({ ok: false, error: 'dot_storage_unavailable' });
    }
  });
}
