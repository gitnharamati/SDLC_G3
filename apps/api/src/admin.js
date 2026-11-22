import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { getProducts } from './catalogue.js';
import { deleteProduct } from './delete-product.js';
import { updateProduct } from './update-product.js';
import { receivePhotos, preparePhotos, changePhotos, productPhotos, photoResponse, PhotoInputError } from './photos.js';
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
  const input = req => {
    if (!req.is('multipart/form-data')) return req.body;
    try { return JSON.parse(req.body.product); }
    catch { throw new ProductInputError('The product form could not be read.'); }
  };
  const idFrom = req => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ProductInputError('Invalid product ID.');
    return id;
  };
  const handleInputError = (error, res, next) => {
    if (error instanceof ProductInputError || error instanceof PhotoInputError) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  };
  router.get('/products', requireSession, async (_req, res) => res.json({ products: await getProducts(db, true) }));
  router.get('/photos/:id', requireSession, photoResponse(db, true));
  router.post('/products', requireSession, receivePhotos, async (req, res, next) => {
    try {
      const photos = await preparePhotos(req.files);
      return res.status(201).json({ product: await addProduct(db, input(req), photos) });
    } catch (error) { return handleInputError(error, res, next); }
  });
  router.post('/products/:id/delete', requireSession, async (req, res, next) => {
    try {
      const id = idFrom(req);
      if (req.body?.confirmProductId !== id) throw new ProductInputError('Confirm the product before deleting it.');
      if (!await deleteProduct(db, id)) return res.status(404).json({ error: 'Product not found. It may already have been deleted.' });
      return res.json({ deleted: true, id });
    } catch (error) { return handleInputError(error, res, next); }
  });
  router.post('/products/:id', requireSession, async (req, res, next) => {
    try {
      if (!await updateProduct(db, idFrom(req), req.body)) return res.status(404).json({ error: 'Product not found.' });
      return res.json({ saved: true });
    } catch (error) { return handleInputError(error, res, next); }
  });
  router.get('/products/:id/photos', requireSession, async (req, res, next) => {
    try { return res.json({ photos: await productPhotos(db, idFrom(req)) }); }
    catch (error) { return handleInputError(error, res, next); }
  });
  router.post('/products/:id/photos', requireSession, receivePhotos, async (req, res, next) => {
    try {
      let keepIds;
      try { keepIds = JSON.parse(req.body.keepIds); }
      catch { throw new PhotoInputError('The photo selection could not be read.'); }
      const photos = await preparePhotos(req.files);
      const id = idFrom(req);
      if (!await changePhotos(db, id, keepIds, photos)) return res.status(404).json({ error: 'Product not found.' });
      return res.json({ photos: await productPhotos(db, id) });
    } catch (error) { return handleInputError(error, res, next); }
  });
  router.post('/logout', (req, res) => {
    sessions.delete(token(req));
    res.clearCookie(cookieName, cookieOptions).status(204).end();
  });
  return router;
}
