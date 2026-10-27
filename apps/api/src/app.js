import express from 'express';
import { getCatalogue, getProducts } from './catalogue.js';

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected', milestone: 'foundation' });
  });
  app.get('/api/catalogue', (_req, res) => res.json({ departments: getCatalogue(db) }));
  app.get('/api/products', (_req, res) => res.json({ products: getProducts(db) }));
  // No mutation endpoints are exposed before admin authentication is implemented.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(error.message);
    res.status(500).json({ error: 'The server could not complete the request' });
  });
  return app;
}
