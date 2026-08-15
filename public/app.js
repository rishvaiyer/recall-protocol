import { clampPosition, createGraphModel, getNodeDetail, nodeMatchesFilter, nudgePosition } from '/graph-model.js';

const $ = (selector) => document.querySelector(selector);
const svg = $('#network');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
let snapshot;
let filter = 'all';
let selectedId = null;
let activeNode = null;
let activeEdge = null;
let dragging = null;
let suppressClick = false;
let sequenceToken = 0;
const positions = JSON.parse(localStorage.getItem('recall-network-positions') || '{}');

function graph() { return createGraphModel(snapshot); }
function position(node) { return positions[node.id] || { x: node.x, y: node.y }; }
function nodeById(id) { return graph().nodes.find((node) => node.id === id); }
function edgePath(source, target) { const dx = target.x - source.x; const dy = target.y - source.y; const curve = Math.max(24, Math.min(80, Math.abs(dx) * 0.12)); return `M ${source.x} ${source.y} C ${source.x} ${source.y + curve} ${target.x} ${target.y - curve} ${target.x} ${target.y}`; }
function typeShape(node) {
  if (node.type === 'incident') return `<circle class="node-shape" r="43" fill="#2d251a" stroke="#e2ae4d"/><circle r="33" fill="none" stroke="#e2ae4d55" stroke-dasharray="3 5"/>`;
  if (node.type === 'district') return `<rect class="node-shape" x="-62" y="-29" width="124" height="58" rx="12" fill="#18302e" stroke="#65ceb9aa"/>`;
  if (node.type === 'resident') return `<rect class="node-shape" x="-62" y="-28" width="124" height="56" rx="28" fill="#241f39" stroke="#9888ffaa"/>`;
  if (node.type === 'object') return `<rect class="node-shape" x="-57" y="-25" width="114" height="50" rx="8" fill="#34221f" stroke="#ff786daa"/>`;
  return `<rect class="node-shape" x="-62" y="-24" width="124" height="48" rx="8" fill="#182839" stroke="#75a9ffaa"/>`;
}

function renderMetrics() {
  const metrics = snapshot.metrics || { objects: snapshot.objects.length, affected: snapshot.related.length, claims: snapshot.claims.length, unresolved: snapshot.objects.filter((item) => item.batch === 'M-17' && item.status === 'in_circulation').length };
  $('#metrics').innerHTML = [['12', 'objects in fixture'], [String(metrics.affected), 'objects linked by recall'], [String(metrics.claims), 'transactional claims'], [String(metrics.unresolved), 'still in circulation']].map(([value, label]) => `<div class="metric"><div class="metric-value">${esc(value)}</div><div class="metric-label">${esc(label)}</div></div>`).join('');
}

function renderGraph() {
  const model = graph();
  const visible = new Map(model.nodes.map((node) => [node.id, nodeMatchesFilter(snapshot, node, filter)]));
  const edgeMarkup = model.edges.map((edge) => {
    const source = position(nodeById(edge.source)); const target = position(nodeById(edge.target));
    const midX = (source.x + target.x) / 2; const midY = (source.y + target.y) / 2 - 5;
    const dim = !visible.get(edge.source) || !visible.get(edge.target);
    return `<g class="edge-group ${dim ? 'dim' : ''}"><path class="edge ${edge.kind} ${activeEdge === edge.id ? 'active' : ''}" data-edge-id="${edge.id}" d="${edgePath(source, target)}"></path><text class="edge-label" x="${midX}" y="${midY}">${esc(edge.label)}</text></g>`;
  }).join('');
  const nodeMarkup = model.nodes.map((node) => {
    const p = position(node); const dim = !visible.get(node.id); const selected = selectedId === node.id; const active = activeNode === node.id;
    const title = node.type === 'incident' ? node.short : node.short || node.label;
    const label = node.type === 'incident' ? 'RECALL' : node.type === 'object' ? node.label : node.label;
    return `<g class="graph-node ${dim ? 'dim' : ''} ${selected ? 'selected' : ''} ${active ? 'active' : ''}" data-node-id="${node.id}" transform="translate(${p.x} ${p.y})" role="button" tabindex="0" aria-label="Inspect ${esc(node.label)}"><title>${esc(node.label)} · ${esc(node.status)}</title>${typeShape(node)}<text class="node-icon" y="-7">${esc(title)}</text><text class="node-label" y="11">${esc(label.length > 19 ? `${label.slice(0, 18)}…` : label)}</text><text class="node-sub" y="25">${esc(node.status)}</text></g>`;
  }).join('');
  svg.innerHTML = `<g class="edges">${edgeMarkup}</g><g class="nodes">${nodeMarkup}</g>`;
  svg.querySelectorAll('.graph-node').forEach((element) => {
    element.addEventListener('keydown', (event) => handleNodeKeydown(event, element.dataset.nodeId));
  });
}

function selectNode(nodeId) { selectedId = nodeId; renderInspector(); }

svg.addEventListener('click', (event) => {
  const element = event.target.closest?.('.graph-node');
  if (!element || suppressClick) { suppressClick = false; return; }
  selectNode(element.dataset.nodeId);
  renderGraph();
  renderInspector();
});

svg.addEventListener('pointerdown', (event) => {
  const element = event.target.closest?.('.graph-node');
  if (!element || event.button !== 0) return;
  const node = nodeById(element.dataset.nodeId);
  if (!node) return;
  selectNode(node.id);
  const start = svgPoint(event);
  const origin = position(node);
  dragging = { id: node.id, dx: origin.x - start.x, dy: origin.y - start.y, moved: false, pointerId: event.pointerId };
  svg.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

svg.addEventListener('pointermove', moveDrag);
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);

function renderInspector() {
  const node = selectedId ? nodeById(selectedId) : null;
  if (!node) { $('#inspector').innerHTML = '<div class="inspector-empty"><span class="inspector-icon">⌁</span><strong>Pick a node</strong><span>The inspector will explain what it is, where it sits, and why it is connected.</span></div>'; return; }
  const detail = getNodeDetail(snapshot, node);
  const fields = detail.fields.map(([label, value]) => `<div class="field"><span>${esc(label)}</span><span>${esc(value)}</span></div>`).join('');
  const history = detail.history?.length ? `<div class="inspector-section"><h4>RECENT HISTORY</h4><ul class="history">${detail.history.map((entry) => `<li>${esc(entry)}</li>`).join('')}</ul></div>` : '';
  $('#inspector').innerHTML = `<div class="inspector-head"><div><div class="inspector-kicker">${esc(detail.eyebrow)}</div><h3>${esc(detail.title)}</h3></div><button class="close-inspector" aria-label="Close inspector">×</button></div><p class="inspector-copy">${esc(detail.what)}</p><div class="inspector-fields">${fields}</div><div class="inspector-section"><h4>WHY THIS LINK EXISTS</h4><p>${esc(detail.why)}</p></div>${history}`;
  $('.close-inspector').addEventListener('click', () => { selectedId = null; renderGraph(); renderInspector(); });
}

function renderEvents(events = snapshot.events) {
  const residents = new Map(snapshot.residents.map((resident) => [resident.id, resident.name]));
  $('#events').innerHTML = events.slice().reverse().map((item) => `<div class="event"><span class="event-dot"></span><div><div class="event-title">${esc(item.summary)}</div><div class="event-meta">${esc(item.type)} · ${esc(item.actorId === 'system' ? 'SYSTEM' : residents.get(item.actorId) || item.actorId)}</div></div><span class="event-time">${esc(item.id)}</span></div>`).join('');
}

function render() { $('#storageMode').textContent = snapshot.storageMode; renderMetrics(); renderGraph(); renderInspector(); renderEvents(); }
async function load(path, options) { const response = await fetch(path, options); if (!response.ok) throw new Error(await response.text()); return response.json(); }
async function refresh() { snapshot = await load('/api/state'); render(); }
function svgPoint(event) { const rect = svg.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (900 / rect.width), y: (event.clientY - rect.top) * (560 / rect.height) }; }
function moveDrag(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  const node = nodeById(dragging.id); const point = svgPoint(event); const next = clampPosition({ x: point.x + dragging.dx, y: point.y + dragging.dy });
  if (Math.abs(next.x - position(node).x) + Math.abs(next.y - position(node).y) > 2) dragging.moved = true;
  positions[node.id] = next;
  const element = svg.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`); element?.setAttribute('transform', `translate(${next.x} ${next.y})`); renderGraphEdgesOnly();
}
function endDrag(event) {
  if (!dragging || (event.pointerId != null && event.pointerId !== dragging.pointerId)) return;
  suppressClick = dragging.moved;
  localStorage.setItem('recall-network-positions', JSON.stringify(positions));
  svg.releasePointerCapture?.(dragging.pointerId);
  dragging = null;
  setTimeout(() => { suppressClick = false; }, 0);
}
function handleNodeKeydown(event, nodeId) {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(nodeId); renderGraph(); renderInspector(); return; }
  const deltas = { ArrowUp: [0, -12], ArrowDown: [0, 12], ArrowLeft: [-12, 0], ArrowRight: [12, 0] };
  const delta = deltas[event.key]; if (!delta) return;
  event.preventDefault(); selectedId = nodeId; const node = nodeById(nodeId); positions[nodeId] = nudgePosition(position(node), ...delta); localStorage.setItem('recall-network-positions', JSON.stringify(positions)); renderGraph(); renderInspector(); svg.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`)?.focus();
}
function renderGraphEdgesOnly() { const model = graph(); model.edges.forEach((edge) => { const source = position(nodeById(edge.source)); const target = position(nodeById(edge.target)); const path = svg.querySelector(`[data-edge-id="${CSS.escape(edge.id)}"]`); if (path) path.setAttribute('d', edgePath(source, target)); const label = path?.nextElementSibling; if (label) { label.setAttribute('x', (source.x + target.x) / 2); label.setAttribute('y', (source.y + target.y) / 2 - 5); } }); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function runSequence() {
  const token = ++sequenceToken;
  const steps = [
    ['incident-m17', null, '1 / 5 · Jun reports a flare. The M-17 notice becomes active.'],
    ['district-pirate-cove', 'incident-district-pirate-cove', '2 / 5 · The ledger traces the report to Pirate Cove.'],
    ['lantern-m17-01', 'district-night-market-lantern-m17-01', '3 / 5 · Deterministic recall links four affected lanterns.'],
    ['task-quarantine-01', 'lantern-m17-01-task-quarantine-01', '4 / 5 · Imani claims quarantine; a retry replays the same result.'],
    ['task-warn-02', 'lantern-m17-02-task-warn-02', '5 / 5 · A second owner loses the claim race; a saved checkpoint recovers.']
  ];
  for (const [node, edge, message] of steps) { if (token !== sequenceToken) return; activeNode = node; activeEdge = edge; $('#runStatus').textContent = message; renderGraph(); await delay(700); }
  activeNode = null; activeEdge = null; $('#runStatus').textContent = 'Sequence complete · replay-safe claim, conflict, and interruption recovery are visible in the ledger.'; renderGraph(); renderInspector();
}

$('#runDemo').addEventListener('click', async () => { $('#runDemo').disabled = true; $('#runDemo').textContent = 'Propagating…'; try { snapshot = await load('/api/demo/run', { method: 'POST' }); render(); await runSequence(); } finally { $('#runDemo').disabled = false; $('#runDemo').innerHTML = 'Run again <span aria-hidden="true">↗</span>'; } });
$('#resetDemo').addEventListener('click', async () => { ++sequenceToken; snapshot = await load('/api/demo/reset', { method: 'POST' }); activeNode = null; activeEdge = null; selectedId = null; $('#runStatus').textContent = 'Fixture reset · select a node to inspect it.'; $('#mcpResult').textContent = 'Awaiting a signed read-only query…'; render(); });
$('#resetLayout').addEventListener('click', () => { Object.keys(positions).forEach((key) => delete positions[key]); localStorage.removeItem('recall-network-positions'); selectedId = null; render(); $('#runStatus').textContent = 'Layout reset · drag any node to make your own evidence map.'; });
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button)); renderGraph(); }));
$('#auditBtn').addEventListener('click', async () => { const result = await load('/api/audit?q=claim'); renderEvents(result.results); });
$('#mcpBtn').addEventListener('click', async () => { const result = await load('/api/mcp/audit?question=Which affected items remain unresolved'); $('#mcpResult').textContent = JSON.stringify(result, null, 2); });
refresh().catch((error) => { $('#storageMode').textContent = `ledger unavailable: ${error.message}`; });
