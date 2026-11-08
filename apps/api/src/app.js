import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminRouter } from './admin.js';
import { getCatalogue, getProducts } from './catalogue.js';

export function createApp(db, adminOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected', milestone: 'foundation' });
  });
  app.get('/api/catalogue', (_req, res) => res.json({ departments: getCatalogue(db) }));
  app.get('/api/products', (_req, res) => res.json({ products: getProducts(db) }));
  app.use('/api/admin', adminRouter(adminOptions));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));

  // Serve the built Angular app (after `npm run build`) from the same server.
  const webDist = process.env.WEB_DIST ||
    fileURLToPath(new URL('../../web/dist/home-decor/browser/', import.meta.url));
  if (existsSync(join(webDist, 'index.html'))) {
    app.use(express.static(webDist));
    // Send index.html for page routes like /admin so a refresh works.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(error.message);
    res.status(500).json({ error: 'The server could not complete the request' });
  });
  return app;
}
