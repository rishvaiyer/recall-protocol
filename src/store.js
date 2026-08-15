const RESIDENTS = [
  { id: 'resident-imani', name: 'Imani Vale', role: 'signal keeper', districtId: 'district-night-market', color: '#d9a441' },
  { id: 'resident-tomas', name: 'Tomas Reed', role: 'route runner', districtId: 'district-medieval-village', color: '#61c7b7' },
  { id: 'resident-jun', name: 'Jun Harbor', role: 'dock steward', districtId: 'district-pirate-cove', color: '#8e7dff' }
];

const DISTRICTS = [
  { id: 'district-night-market', name: 'Night Market', short: 'NM', tone: 'amber', summary: 'Lantern stalls, awnings, and a crowded evening route.' },
  { id: 'district-medieval-village', name: 'Medieval Village', short: 'MV', tone: 'mint', summary: 'Stone lanes where traded goods change hands.' },
  { id: 'district-pirate-cove', name: 'Pirate Cove', short: 'PC', tone: 'violet', summary: 'A salt-air dock with a long memory for cargo.' }
];

const OBJECTS = [
  ['lantern-m17-01', 'Moonfire Lantern 01', 'M-17', 'Night Market', 'A copper lantern with a crescent cutout; traded at the west arch.'],
  ['lantern-m17-02', 'Moonfire Lantern 02', 'M-17', 'Medieval Village', 'A blue-glass lantern, gifted after the harvest route.'],
  ['lantern-m17-03', 'Moonfire Lantern 03', 'M-17', 'Pirate Cove', 'A salt-stained lantern kept beside the signal bell.'],
  ['lantern-m17-04', 'Moonfire Lantern 04', 'M-17', 'Night Market', 'A small red lantern in a locked night stall.'],
  ['lantern-s09-01', 'Sunspoke Lantern 01', 'S-09', 'Night Market', 'A brass festival lantern with a warm, steady flame.'],
  ['lantern-s09-02', 'Sunspoke Lantern 02', 'S-09', 'Medieval Village', 'A paper-shade lantern used on the mill road.'],
  ['lantern-t03-01', 'Tideglass Lantern 01', 'T-03', 'Pirate Cove', 'A green tideglass lantern for low-visibility docks.'],
  ['lantern-t03-02', 'Tideglass Lantern 02', 'T-03', 'Pirate Cove', 'A repaired lantern with a whale-bone handle.'],
  ['lantern-ash-01', 'Ashbell Lantern 01', 'A-04', 'Medieval Village', 'A black iron lantern from the old bell tower.'],
  ['lantern-ash-02', 'Ashbell Lantern 02', 'A-04', 'Night Market', 'An iron lantern used to mark the closing stall.'],
  ['lantern-reef-01', 'Reefstar Lantern 01', 'R-11', 'Pirate Cove', 'A star-shaped lantern that floats during tide festivals.'],
  ['lantern-reef-02', 'Reefstar Lantern 02', 'R-11', 'Medieval Village', 'A carved shell lantern stored above the bakery.']
].map(([id, name, batch, district, description], index) => ({ id, name, batch, district, description, index }));

const INITIAL_HOLDERS = [
  'resident-imani', 'resident-tomas', 'resident-jun', 'resident-imani', 'resident-imani', 'resident-tomas',
  'resident-jun', 'resident-jun', 'resident-tomas', 'resident-imani', 'resident-jun', 'resident-tomas'
];

const clone = (value) => structuredClone(value);
const now = () => '2026-08-15T12:00:00.000Z';

function freshState() {
  return {
    version: 1,
    incident: { id: 'incident-moonfire-m17', code: 'M-17', title: 'Moonfire Lantern recall', severity: 'high', status: 'detected', notice: 'A heat flare can occur after the third lighting. Quarantine affected lanterns and warn current holders.' },
    residents: clone(RESIDENTS),
    districts: clone(DISTRICTS),
    objects: OBJECTS.map((item, index) => ({ ...item, holderId: INITIAL_HOLDERS[index], status: 'in_circulation', lastEventId: null })),
    events: [{ id: 'evt-000', type: 'system.ready', at: now(), actorId: 'system', summary: 'Recall ledger opened with synthetic fixture snapshot.', metadata: { fixture: 'moonfire-m17', objects: 12 } }],
    claims: [],
    idempotency: {},
    related: [],
    lastRun: null
  };
}

const residentName = (state, id) => state.residents.find((resident) => resident.id === id)?.name || id;

export function createStore() {
  let state = freshState();
  const storageMode = process.env.COCKROACHDB_URL || process.env.DATABASE_URL ? 'cockroach-compatible-adapter-ready' : 'memory-fallback (no cluster secret)';

  const event = (type, actorId, summary, metadata = {}) => {
    const id = `evt-${String(state.events.length).padStart(3, '0')}`;
    const record = { id, type, at: now(), actorId, summary, metadata };
    state.events.push(record);
    return record;
  };

  const relatedRecall = (query) => {
    const tokens = query.toLowerCase().split(/[^a-z0-9-]+/).filter((token) => token.length > 2);
    const batchScoped = tokens.includes('m-17');
    const scored = state.objects.filter((item) => !batchScoped || item.batch === 'M-17').map((item) => {
      const haystack = `${item.name} ${item.batch} ${item.district} ${item.description}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { objectId: item.id, score, reason: score ? 'batch, description, or district token match' : 'no match' };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.objectId.localeCompare(b.objectId));
    state.related = scored;
    event('recall.related_items', 'system', `Deterministic recall linked ${scored.length} objects to the incident.`, { query, algorithm: 'token-intersection-v1', vector: false });
    return scored;
  };

  const claimTask = ({ taskId, agentId, idempotencyKey, action = 'warn', objectId }) => {
    if (!taskId || !agentId || !idempotencyKey) throw new Error('taskId, agentId, and idempotencyKey are required');
    const previous = state.idempotency[idempotencyKey];
    if (previous) return { ...clone(previous), replayed: true };
    const existing = state.claims.find((claim) => claim.taskId === taskId && claim.status === 'claimed');
    const interrupted = state.claims.find((claim) => claim.taskId === taskId && claim.status === 'interrupted');
    const agent = state.residents.find((resident) => resident.id === agentId);
    if (!agent) throw new Error('unknown agent');
    let result;
    if (existing) {
      result = { ok: false, status: 'conflict', taskId, winner: existing.agentId, winnerName: residentName(state, existing.agentId), message: `Task already owned by ${residentName(state, existing.agentId)}.` };
      event('claim.conflict', agentId, `${residentName(state, agentId)} lost the serializable claim race.`, { taskId, winner: existing.agentId, idempotencyKey });
    } else if (interrupted) {
      interrupted.agentId = agentId;
      interrupted.status = 'claimed';
      interrupted.claimedAt = now();
      result = { ok: true, status: 'recovered', taskId, agentId, agentName: agent.name, checkpoint: interrupted.checkpoint, message: `${agent.name} resumed from ${interrupted.checkpoint}.` };
      event('claim.recovered', agentId, `${agent.name} resumed ${taskId} from the saved checkpoint.`, { taskId, resumedFrom: interrupted.checkpoint, idempotencyKey });
    } else {
      const claim = { taskId, agentId, action, objectId: objectId || null, status: 'claimed', claimedAt: now(), checkpoint: 'claim-accepted' };
      state.claims.push(claim);
      result = { ok: true, status: 'claimed', taskId, agentId, agentName: agent.name, checkpoint: claim.checkpoint, message: `${agent.name} owns this task.` };
      event('claim.accepted', agentId, `${agent.name} claimed ${taskId}.`, { taskId, action, objectId, idempotencyKey });
    }
    state.idempotency[idempotencyKey] = clone(result);
    return result;
  };

  const runDemo = () => {
    state = freshState();
    event('incident.detected', 'resident-jun', 'Jun reported a flare at Pirate Cove; the M-17 notice was opened.', { incidentId: state.incident.id, districtId: 'district-pirate-cove' });
    state.incident.status = 'active';
    relatedRecall('Moonfire M-17 heat flare lantern recall');
    claimTask({ taskId: 'quarantine:lantern-m17-01', agentId: 'resident-imani', idempotencyKey: 'demo-imani-01', action: 'quarantine', objectId: 'lantern-m17-01' });
    const replay = claimTask({ taskId: 'quarantine:lantern-m17-01', agentId: 'resident-imani', idempotencyKey: 'demo-imani-01', action: 'quarantine', objectId: 'lantern-m17-01' });
    event('claim.replayed', 'system', 'Network retry returned the original result without a duplicate claim.', { idempotencyKey: 'demo-imani-01', replayed: replay.replayed === true });
    claimTask({ taskId: 'warn:lantern-m17-02', agentId: 'resident-imani', idempotencyKey: 'demo-race-imani', action: 'warn', objectId: 'lantern-m17-02' });
    claimTask({ taskId: 'warn:lantern-m17-02', agentId: 'resident-tomas', idempotencyKey: 'demo-race-tomas', action: 'warn', objectId: 'lantern-m17-02' });
    const interrupted = claimTask({ taskId: 'retrieve:lantern-m17-03', agentId: 'resident-tomas', idempotencyKey: 'demo-tomas-03', action: 'retrieve', objectId: 'lantern-m17-03' });
    const claim = state.claims.find((item) => item.taskId === 'retrieve:lantern-m17-03');
    claim.status = 'interrupted';
    claim.checkpoint = 'route-scanned';
    event('claim.interrupted', 'system', 'Tomas went offline after recording the route checkpoint.', { taskId: claim.taskId, checkpoint: claim.checkpoint });
    claimTask({ taskId: 'retrieve:lantern-m17-03', agentId: 'resident-jun', idempotencyKey: 'demo-recovery-jun', action: 'retrieve', objectId: 'lantern-m17-03' });
    state.objects.find((item) => item.id === 'lantern-m17-01').status = 'quarantined';
    state.objects.find((item) => item.id === 'lantern-m17-03').status = 'recovered';
    state.incident.status = 'contained';
    state.lastRun = { replayed: replay.replayed === true, conflict: true, interruptionRecovered: true, completedAt: now() };
    return snapshot();
  };

  const snapshot = () => ({ storageMode, ...clone(state), metrics: { objects: state.objects.length, affected: state.related.length, claims: state.claims.length, events: state.events.length, unresolved: state.objects.filter((item) => item.batch === 'M-17' && item.status === 'in_circulation').length } });
  const audit = ({ q = '' } = {}) => {
    const needle = q.toLowerCase();
    return { readOnly: true, source: 'event-ledger', query: q, results: clone(state.events.filter((item) => !needle || JSON.stringify(item).toLowerCase().includes(needle)).reverse().slice(0, 30)) };
  };
  const mcpAudit = ({ question }) => {
    const affected = state.objects.filter((item) => item.batch === 'M-17');
    const unresolved = affected.filter((item) => item.status === 'in_circulation');
    return { tool: 'recall.audit', readOnly: true, question, generatedAt: now(), answer: `${unresolved.length} M-17 lantern(s) remain in circulation.`, affected: affected.map((item) => ({ id: item.id, name: item.name, district: item.district, holder: residentName(state, item.holderId), status: item.status })), proof: state.events.slice(-5).map((item) => item.id) };
  };
  const reset = () => { state = freshState(); return snapshot(); };
  return { storageMode, snapshot, reset, runDemo, claimTask, audit, mcpAudit };
}
