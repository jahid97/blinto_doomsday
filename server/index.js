import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
import { createStore } from './store.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const filename = process.env.DATABASE_PATH || resolve(root, 'data/doomsday.sqlite');
if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });

const store = createStore(filename);
if (process.env.SEED_DEMO !== '0') store.seed();

const app = createApp(store);
const server = createServer(app);
const dev = process.argv.includes('--dev');

if (dev) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ root, server: { middlewareMode: true, hmr: { server } } });
  app.use(vite.middlewares);
  server.once('close', () => void vite.close());
} else {
  app.use(express.static(resolve(root, 'dist')));
}

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
server.listen(port, host, () => console.log(`Doomsday Ready running at http://${host}:${server.address().port}`));
server.once('close', () => store.close());
