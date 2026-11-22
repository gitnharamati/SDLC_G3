import multer from 'multer';
import sharp from 'sharp';
import { randomUUID, createHash } from 'node:crypto';
import { transaction } from './postgres/database.js';

export const MAX_PHOTOS = 4;
export class PhotoInputError extends Error {}

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_PHOTOS, fileSize: 5 * 1024 * 1024, fields: 1, fieldSize: 25000, parts: MAX_PHOTOS + 1 }
}).array('photos', MAX_PHOTOS);

export function receivePhotos(req, res, next) {
  receive(req, res, error => {
    if (!error) return next();
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Each photo must be 5 MB or smaller.' : 'Choose up to four photos and one product form.'
    });
  });
}

export async function preparePhotos(files = []) {
  if (files.length > MAX_PHOTOS) throw new PhotoInputError('A product can have up to four photos.');
  const photos = [];
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new PhotoInputError('Choose JPG, PNG or WebP photos.');
    }
    try {
      const image = sharp(file.buffer, { limitInputPixels: 25_000_000, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) !== 1) {
        throw new Error('Unsupported photo');
      }
      // Re-encode to remove metadata and discard anything beyond decoded pixels.
      const data = await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
      if (data.length > 2 * 1024 * 1024) throw new Error('Encoded photo is too large');
      photos.push({ data, mime: 'image/jpeg', token: randomUUID() });
    } catch {
      throw new PhotoInputError('One photo could not be read. Use a smaller, valid JPG, PNG or WebP image.');
    }
  }
  return photos;
}

export function insertSqlitePhotos(db, productId, photos, start = 0) {
  const insert = db.prepare('INSERT INTO product_photos(product_id, path, position, mime_type, data) VALUES (?, ?, ?, ?, ?)');
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const id = Number(insert.run(productId, '', start + i, photo.mime, photo.data).lastInsertRowid);
    db.prepare('UPDATE product_photos SET path = ? WHERE id = ?').run(`/api/photos/${id}?v=${photo.token}`, id);
  }
}
export async function insertPostgresPhotos(client, productId, photos, start = 0) {
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const { rows: [{ id }] } = await client.query(
      'INSERT INTO product_photos(product_id, path, position, mime_type, data) VALUES($1, $2, $3, $4, $5) RETURNING id',
      [productId, '', start + i, photo.mime, photo.data]);
    await client.query('UPDATE product_photos SET path = $1 WHERE id = $2', [`/api/photos/${id}?v=${photo.token}`, id]);
  }
}

export async function productPhotos(db, id) {
  const query = 'SELECT id, path FROM product_photos WHERE product_id = ';
  const rows = db.kind === 'postgres'
    ? (await db.pool.query(query + '$1 ORDER BY position', [id])).rows
    : db.prepare(query + '? ORDER BY position').all(id);
  return rows.map(photo => ({ id: photo.id, url: photo.path,
    previewUrl: '/api/admin/photos/' + photo.id }));
}

export async function changePhotos(db, productId, keepIds, newPhotos) {
  const action = async client => {
    const query = async (sql, values = []) => (await client.query(sql, values)).rows;
    const found = await query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [productId]);
    if (!found.length) return false;
    const current = await query('SELECT id FROM product_photos WHERE product_id = $1 ORDER BY position', [productId]);
    if (!Array.isArray(keepIds) || keepIds.some(id => !Number.isSafeInteger(id)) ||
        new Set(keepIds).size !== keepIds.length || keepIds.some(id => !current.some(photo => photo.id === id)) ||
        keepIds.length + newPhotos.length > MAX_PHOTOS) {
      throw new PhotoInputError('Keep only this product’s photos, up to four in total.');
    }
    const write = (sql, values) => client.query(sql, values);
    // Move existing positions out of the way before reordering their unique slots.
    await write('UPDATE product_photos SET position = position + 1000 WHERE product_id = $1', [productId]);
    for (const photo of current) {
      if (!keepIds.includes(photo.id)) await write('DELETE FROM product_photos WHERE id = $1 AND product_id = $2', [photo.id, productId]);
    }
    for (let i = 0; i < keepIds.length; i++) {
      await write('UPDATE product_photos SET position = $1 WHERE id = $2 AND product_id = $3', [i, keepIds[i], productId]);
    }
    await insertPostgresPhotos(client, productId, newPhotos, keepIds.length);
    return true;
  };
  if (db.kind === 'postgres') return transaction(db.pool, action);
  // Keep local SQLite writes synchronous until COMMIT.
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(productId)) { db.exec('ROLLBACK'); return false; }
    const current = db.prepare('SELECT id FROM product_photos WHERE product_id = ? ORDER BY position').all(productId);
    if (!Array.isArray(keepIds) || keepIds.some(id => !Number.isSafeInteger(id)) ||
        new Set(keepIds).size !== keepIds.length || keepIds.some(id => !current.some(photo => photo.id === id)) ||
        keepIds.length + newPhotos.length > MAX_PHOTOS) throw new PhotoInputError('Keep only this product’s photos, up to four in total.');
    db.prepare('UPDATE product_photos SET position = position + 1000 WHERE product_id = ?').run(productId);
    for (const photo of current) if (!keepIds.includes(photo.id)) db.prepare('DELETE FROM product_photos WHERE id = ?').run(photo.id);
    for (let i = 0; i < keepIds.length; i++) db.prepare('UPDATE product_photos SET position = ? WHERE id = ?').run(i, keepIds[i]);
    insertSqlitePhotos(db, productId, newPhotos, keepIds.length);
    db.exec('COMMIT'); return true;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function photoResponse(db, admin = false) {
  return async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).end();
    const sql = `SELECT f.data, f.mime_type FROM product_photos f
      JOIN products p ON p.id = f.product_id WHERE f.id = ${db.kind === 'postgres' ? '$1' : '?'}
      ${admin ? '' : 'AND p.available = 1'}`;
    const row = db.kind === 'postgres' ? (await db.pool.query(sql, [id])).rows[0] : db.prepare(sql).get(id);
    if (!row?.data) return res.status(404).end();
    const data = Buffer.from(row.data);
    res.set('Content-Type', 'image/jpeg');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', admin ? 'no-store' : 'public, max-age=0, must-revalidate');
    res.set('ETag', '"' + createHash('sha256').update(data).digest('hex') + '"');
    res.send(data);
  };
}
