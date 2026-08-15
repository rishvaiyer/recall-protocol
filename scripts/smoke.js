import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const child = spawn(process.execPath, ['server.js'], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, PORT: '4397' } });
await new Promise((resolve) => setTimeout(resolve, 250));
try {
  const health = await fetch('http://127.0.0.1:4397/health').then((response) => response.json());
  const initial = await fetch('http://127.0.0.1:4397/api/state').then((response) => response.json());
  const demo = await fetch('http://127.0.0.1:4397/api/demo/run', { method: 'POST' }).then((response) => response.json());
  const audit = await fetch('http://127.0.0.1:4397/api/mcp/audit').then((response) => response.json());
  assert.equal(health.ok, true); assert.equal(initial.objects.length, 12); assert.equal(demo.lastRun.replayed, true); assert.equal(audit.readOnly, true);
  console.log(JSON.stringify({ health, initialObjects: initial.objects.length, affected: demo.related.length, events: demo.events.length, auditAnswer: audit.answer }, null, 2));
} finally { child.kill('SIGTERM'); }
