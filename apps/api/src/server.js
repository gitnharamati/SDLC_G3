import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { createApp } from './app.js';

const databasePath = process.env.DATABASE_PATH || fileURLToPath(new URL('../data/home-decor.sqlite', import.meta.url));
const db = openDatabase(databasePath);
const port = Number(process.env.PORT || 3000);
const server = createApp(db, {
  password: process.env.ADMIN_PASSWORD,
  secure: process.env.NODE_ENV === 'production'
}).listen(port, '127.0.0.1', () => {
  console.log(`Home Decor API: http://localhost:${port}/api/health`);
});
function stop() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
