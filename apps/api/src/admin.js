import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { addProduct, ProductInputError } from './product-editor.js';

const cookieName = 'decor_admin';
const sessionMs = 30 * 60 * 1000;
const failureWindowMs = 60 * 1000;

export function adminRouter(db, { password, secure = false } = {}) {
  const router = Router();
  const enabled = typeof password === 'string' && password.length >= 12 && password.length <= 256;
  const salt = randomBytes(16);
  const hash = enabled ? scryptSync(password, salt, 32) : null;
  const sessions = new Map();
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure, path: '/api/admin' };
  const failuresByClient = new Map();
  let nextCleanup = 0;

  function token(req) {
    return req.headers.cookie?.match(/(?:^|;\s*)decor_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
  }
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!enabled) return res.status(503).json({ error: 'Admin access is not configured.' });
    if (req.method === 'POST' && req.get('X-Admin-Request') !== '1') {
      return res.status(403).json({ error: 'Request not allowed.' });
    }
    next();
  });
  router.post('/login', (req, res) => {
    const now = Date.now();
    const client = req.ip;
    if (now >= nextCleanup) {
      for (const [ip, entry] of failuresByClient) {
        if (entry.resetAt <= now) failuresByClient.delete(ip);
      }
      nextCleanup = now + failureWindowMs;
    }
    const previous = failuresByClient.get(client);
    const current = previous?.resetAt > now ? previous : { count: 0, resetAt: now + failureWindowMs };
    if (current.count >= 5) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }
    const candidate = req.body?.password;
    if (typeof candidate !== 'string' || candidate.length > 256 ||
        !timingSafeEqual(hash, scryptSync(candidate, salt, 32))) {
      current.count++;
      failuresByClient.set(client, current);
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    failuresByClient.delete(client);
    for (const [key, expires] of sessions) if (expires <= now) sessions.delete(key);
    sessions.delete(token(req));
    const key = randomBytes(32).toString('hex');
    sessions.set(key, now + sessionMs);
    res.cookie(cookieName, key, { ...cookieOptions, maxAge: sessionMs });
    return res.json({ signedIn: true });
  });
  function requireSession(req, res, next) {
    const key = token(req);
    if ((sessions.get(key) ?? 0) <= Date.now()) {
      sessions.delete(key);
      return res.status(401).json({ error: 'Sign in to open the admin area.' });
    }
    next();
  }
  router.get('/session', requireSession, (_req, res) => res.json({ signedIn: true }));
  router.post('/products', requireSession, (req, res, next) => {
    try {
      return res.status(201).json({ product: addProduct(db, req.body) });
    } catch (error) {
      if (error instanceof ProductInputError) return res.status(400).json({ error: error.message });
      return next(error);
    }
  });
  router.post('/logout', (req, res) => {
    sessions.delete(token(req));
    res.clearCookie(cookieName, cookieOptions).status(204).end();
  });
  return router;
}
