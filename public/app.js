const $ = (selector) => document.querySelector(selector);
let snapshot;
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const resident = (id) => snapshot.residents.find((item) => item.id === id);

function render() {
  $('#storageMode').textContent = snapshot.storageMode;
  const affected = new Set(snapshot.related.map((item) => item.objectId));
  const claimed = new Set(snapshot.claims.map((item) => item.objectId));
  const unresolved = snapshot.objects.filter((item) => item.batch === 'M-17' && item.status === 'in_circulation').length;
  $('#metrics').innerHTML = [['12', 'objects in fixture'], [String(affected.size), 'related by deterministic recall'], [String(snapshot.claims.length), 'transactional claims'], [String(unresolved), 'still in circulation']].map(([value, label]) => `<div class="metric"><div class="metric-value">${value}</div><div class="metric-label">${label}</div></div>`).join('');
  $('#districts').innerHTML = snapshot.districts.map((district) => { const items = snapshot.objects.filter((item) => item.district === district.name); const affectedHere = items.filter((item) => affected.has(item.id)); return `<article class="district"><div class="district-head"><span>${district.short}</span><span>${affectedHere.length ? `${affectedHere.length} affected` : 'clear'}</span></div><div class="district-name">${esc(district.name)}</div><div class="district-summary">${esc(district.summary)}</div><div class="district-items">${affectedHere.length ? affectedHere.map((item) => `${esc(item.name.replace('Moonfire Lantern ', 'M-17 / '))}${claimed.has(item.id) ? ' · claimed' : ''}`).join('<br>') : 'No linked recall items'}</div></article>`; }).join('');
  $('#agents').innerHTML = snapshot.residents.map((agent) => { const claims = snapshot.claims.filter((claim) => claim.agentId === agent.id); const interrupted = claims.find((claim) => claim.status === 'interrupted'); return `<div class="agent"><div class="avatar" style="background:${agent.color}">${agent.name.split(' ').map((x) => x[0]).join('')}</div><div class="agent-main"><div class="agent-name">${esc(agent.name)}</div><div class="agent-role">${esc(agent.role)} · ${esc(snapshot.districts.find((d) => d.id === agent.districtId).name)}</div></div><div class="agent-status">${interrupted ? 'RECOVERED' : claims.length ? `${claims.length} CLAIM` : 'STANDING BY'}</div></div>`; }).join('');
  $('#agentCount').textContent = `${snapshot.residents.length} online`;
  $('#events').innerHTML = snapshot.events.slice().reverse().map((item) => `<div class="event"><span class="event-dot"></span><div><div class="event-title">${esc(item.summary)}</div><div class="event-meta">${esc(item.type)} · ${esc(item.actorId === 'system' ? 'SYSTEM' : resident(item.actorId)?.name || item.actorId)}</div></div><span class="event-time">${item.id}</span></div>`).join('');
}

async function load(path, options) { const response = await fetch(path, options); if (!response.ok) throw new Error(await response.text()); return response.json(); }
async function refresh() { snapshot = await load('/api/state'); render(); }
$('#runDemo').addEventListener('click', async () => { $('#runDemo').disabled = true; $('#runDemo').textContent = 'Propagating…'; snapshot = await load('/api/demo/run', { method: 'POST' }); render(); $('#runDemo').disabled = false; $('#runDemo').innerHTML = 'Run again <span>↗</span>'; });
$('#resetDemo').addEventListener('click', async () => { snapshot = await load('/api/demo/reset', { method: 'POST' }); render(); $('#mcpResult').textContent = 'Awaiting a signed read-only query…'; });
$('#auditBtn').addEventListener('click', async () => { const result = await load('/api/audit?q=claim'); $('#events').innerHTML = result.results.map((item) => `<div class="event"><span class="event-dot"></span><div><div class="event-title">${esc(item.summary)}</div><div class="event-meta">${esc(item.type)} · READ-ONLY AUDIT</div></div><span class="event-time">${item.id}</span></div>`).join(''); });
$('#mcpBtn').addEventListener('click', async () => { const result = await load('/api/mcp/audit?question=Which affected items remain unresolved'); $('#mcpResult').textContent = JSON.stringify(result, null, 2); });
refresh().catch((error) => { $('#storageMode').textContent = `ledger unavailable: ${error.message}`; });
