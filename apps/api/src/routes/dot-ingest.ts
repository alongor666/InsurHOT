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
// Per client address, counted before authentication so token guessing and bulk retries are both bounded.
// Same in-memory shape as the admin login limiter; state lives with the app instance, so a restart only relaxes it.
export const DOT_RATE_LIMIT = { perWindow: 60, windowMs: 60_000 };
function rateLimiter() {
  const recent = new Map<string, number[]>();
  return (address: string, now = Date.now()): boolean => {
    const list = (recent.get(address) ?? []).filter((t) => now - t < DOT_RATE_LIMIT.windowMs);
    list.push(now);
    recent.set(address, list);
    if (recent.size > 5000) for (const [k, v] of recent) if (v.every((t) => now - t >= DOT_RATE_LIMIT.windowMs)) recent.delete(k);
    return list.length > DOT_RATE_LIMIT.perWindow;
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
