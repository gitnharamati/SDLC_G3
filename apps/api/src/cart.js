import { Router } from 'express';
import { getProducts } from './catalogue.js';

export function cartRouter(db) {
  const router = Router();
  router.post('/check', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const lines = Array.isArray(req.body) ? req.body : req.body?.lines;
    if (!Array.isArray(lines) || lines.length > 100 || lines.some(line =>
      !line || !Number.isSafeInteger(line.productId) || line.productId < 1 ||
      !Number.isSafeInteger(line.variantId) || line.variantId < 1 ||
      !Number.isSafeInteger(line.qty) || line.qty < 1 || line.qty > 999999) ||
      new Set(lines.map(line => line.variantId)).size !== lines.length) {
      return res.status(400).json({ error: 'Enter up to 100 different combinations with whole quantities from 1 to 999,999.' });
    }
    // Hidden or deleted products never supply private details to a customer.
    const products = await getProducts(db);
    let totalCents = 0;
    const checked = lines.map(line => {
      const product = products.find(p => p.id === line.productId);
      const variant = product?.variants.find(v => v.id === line.variantId);
      if (!product || !variant) return { ...line, available: false, stock: 0, qty: line.qty, lineCents: 0, note: 'No longer available' };
      const qty = Math.min(line.qty, variant.stock);
      const lineCents = product.priceCents * qty;
      totalCents += lineCents;
      return { ...line, qty, requestedQty: line.qty, available: true, stock: variant.stock,
        priceCents: product.priceCents, lineCents, name: product.name, category: product.category,
        room: product.room, photos: product.photos, options: variant.options,
        note: line.qty > variant.stock ? `Only ${variant.stock} left` : '' };
    });
    if (!Number.isSafeInteger(totalCents)) return res.status(400).json({ error: 'The cart total is too large. Reduce the quantities.' });
    return res.json({ lines: checked, totalCents, currency: 'CAD' });
  });
  return router;
}
