import http from 'node:http';
import { URL } from 'node:url';
import { createStore } from './src/store.js';
import { createCockroachAdapter } from './src/cockroach.js';

const port = Number(process.env.PORT || 4319);
const fallbackStore = createStore();
let store = fallbackStore;
const backendReady = (async () => {
  const connectionString = process.env.COCKROACHDB_URL || process.env.DATABASE_URL;
  if (!connectionString) return;
  const adapter = await createCockroachAdapter(connectionString);
  if (!adapter || adapter.unavailable) return;
  store = { ...fallbackStore, storageMode: adapter.storageMode, claimTask: adapter.claimTask.bind(adapter), audit: adapter.audit.bind(adapter), snapshot: () => ({ ...fallbackStore.snapshot(), storageMode: adapter.storageMode, backend: adapter.storageMode }) };
})();

const send = (res, status, body, headers = {}) => {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', ...headers });
  res.end(payload);
};

const readJson = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; if (data.length > 100_000) reject(new Error('payload too large')); });
  req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('invalid json')); } });
  req.on('error', reject);
});

const routes = {
  '/': 'index.html',
  '/styles.css': 'styles.css',
  '/app.js': 'app.js'
};

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const serveStatic = async (res, pathname) => {
  const file = routes[pathname];
  if (!file) return false;
  const text = await import('node:fs/promises').then((fs) => fs.readFile(new URL(`./public/${file}`, import.meta.url), 'utf8'));
  const ext = file.slice(file.lastIndexOf('.'));
  send(res, 200, text, { 'content-type': mime[ext] });
  return true;
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    await backendReady;
    if (await serveStatic(res, url.pathname)) return;
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, service: 'recall-protocol', storage: store.storageMode });
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, store.snapshot());
    if (req.method === 'GET' && url.pathname === '/api/audit') return send(res, 200, store.audit({ q: url.searchParams.get('q') || '' }));
    if (req.method === 'GET' && url.pathname === '/api/mcp/audit') return send(res, 200, store.mcpAudit({ question: url.searchParams.get('question') || 'Which affected items remain unresolved?' }));
    if (req.method === 'POST' && url.pathname === '/api/demo/run') return send(res, 200, store.runDemo());
    if (req.method === 'POST' && url.pathname === '/api/demo/reset') return send(res, 200, store.reset());
    if (req.method === 'POST' && url.pathname === '/api/claims') {
      const input = await readJson(req);
      return send(res, 200, await store.claimTask(input));
    }
    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    return send(res, error.message === 'payload too large' ? 413 : 400, { error: error.message });
  }
});

server.listen(port, () => console.log(`Recall Protocol listening on http://localhost:${port}`));
