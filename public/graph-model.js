export const TASKS = [
  { id: 'task-quarantine-01', taskId: 'quarantine:lantern-m17-01', objectId: 'lantern-m17-01', label: 'Quarantine M-17 / 01', action: 'quarantine', ownerHint: 'Night Market' },
  { id: 'task-warn-02', taskId: 'warn:lantern-m17-02', objectId: 'lantern-m17-02', label: 'Warn M-17 / 02', action: 'warn', ownerHint: 'Medieval Village' },
  { id: 'task-retrieve-03', taskId: 'retrieve:lantern-m17-03', objectId: 'lantern-m17-03', label: 'Retrieve M-17 / 03', action: 'retrieve', ownerHint: 'Pirate Cove' }
];

export const GRAPH_BOUNDS = { minX: 70, maxX: 830, minY: 60, maxY: 500 };
export function clampPosition(point) {
  return { x: Math.max(GRAPH_BOUNDS.minX, Math.min(GRAPH_BOUNDS.maxX, point.x)), y: Math.max(GRAPH_BOUNDS.minY, Math.min(GRAPH_BOUNDS.maxY, point.y)) };
}
export function nudgePosition(point, dx, dy) {
  return clampPosition({ x: point.x + dx, y: point.y + dy });
}

const districtIds = ['district-night-market', 'district-medieval-village', 'district-pirate-cove'];
const affectedIds = (snapshot) => new Set(snapshot.related.map((item) => item.objectId));
const claimsFor = (snapshot, objectId) => snapshot.claims.filter((claim) => claim.objectId === objectId);

export function createGraphModel(snapshot) {
  const related = affectedIds(snapshot);
  const recallObjects = snapshot.objects.filter((item) => related.has(item.id) || item.batch === 'M-17');
  const nodes = [
    { id: 'incident-m17', type: 'incident', label: 'M-17 recall', short: 'M-17', status: snapshot.incident.status, accent: 'incident', x: 450, y: 270 },
    ...snapshot.districts.map((district, index) => ({ id: district.id, type: 'district', label: district.name, short: district.short, status: recallObjects.some((item) => item.district === district.name) ? 'affected' : 'clear', accent: district.tone, x: [145, 450, 755][index], y: 115 })),
    ...snapshot.residents.map((resident, index) => ({ id: resident.id, type: 'resident', label: resident.name, short: resident.name.split(' ').map((part) => part[0]).join(''), status: snapshot.claims.some((claim) => claim.agentId === resident.id) ? 'working' : 'standing by', accent: ['amber', 'mint', 'violet'][index], x: [145, 450, 755][index], y: 470 })),
    ...recallObjects.map((item, index) => ({ id: item.id, type: 'object', label: item.name.replace('Moonfire Lantern ', 'Lantern '), short: item.id.slice(-2), status: item.status, accent: 'object', x: [220, 375, 525, 680][index], y: 205 })),
    ...TASKS.map((task, index) => {
      const claim = snapshot.claims.find((candidate) => candidate.taskId === task.taskId);
      return { ...task, type: 'task', label: task.label, short: task.action, status: claim?.status || 'available', accent: 'task', x: [280, 450, 620][index], y: 365, claim };
    })
  ];
  const edges = [
    ...districtIds.map((id) => ({ id: `incident-${id}`, source: 'incident-m17', target: id, label: 'spans district', kind: 'incident' })),
    ...nodes.filter((node) => node.type === 'district').flatMap((district) => nodes.filter((node) => node.type === 'object' && snapshot.objects.find((item) => item.id === node.id)?.district === snapshot.districts.find((item) => item.id === district.id)?.name).map((item) => ({ id: `${district.id}-${item.id}`, source: district.id, target: item.id, label: 'located in', kind: 'location' }))),
    ...nodes.filter((node) => node.type === 'object').map((item) => {
      const object = snapshot.objects.find((candidate) => candidate.id === item.id);
      return { id: `${item.id}-${object.holderId}`, source: item.id, target: object.holderId, label: 'held by', kind: 'holder' };
    }),
    ...TASKS.map((task) => ({ id: `${task.objectId}-${task.id}`, source: task.objectId, target: task.id, label: 'task for', kind: 'task' }))
  ];
  return { nodes, edges };
}

export function nodeMatchesFilter(snapshot, node, filter) {
  if (filter === 'all') return true;
  const related = affectedIds(snapshot);
  if (filter === 'affected') return node.type === 'incident' || node.type === 'district' || (node.type === 'object' && (related.has(node.id) || snapshot.objects.find((item) => item.id === node.id)?.batch === 'M-17'));
  if (filter === 'unresolved') return node.type === 'incident' || (node.type === 'object' && snapshot.objects.find((item) => item.id === node.id)?.status === 'in_circulation') || (node.type === 'task' && !snapshot.claims.find((claim) => claim.taskId === node.taskId));
  if (filter === 'claimed') return node.type === 'resident' ? snapshot.claims.some((claim) => claim.agentId === node.id) : node.type === 'task' && Boolean(snapshot.claims.find((claim) => claim.taskId === node.taskId));
  if (filter === 'conflicts') return node.type === 'incident' || (node.type === 'task' && snapshot.events.some((event) => event.type === 'claim.conflict' && event.metadata?.taskId === node.taskId));
  return true;
}

export function getNodeDetail(snapshot, node) {
  const district = snapshot.districts.find((item) => item.id === node.id);
  const resident = snapshot.residents.find((item) => item.id === node.id);
  const object = snapshot.objects.find((item) => item.id === node.id);
  const claim = node.type === 'task' ? snapshot.claims.find((item) => item.taskId === node.taskId) : null;
  if (node.type === 'incident') return { eyebrow: 'INCIDENT', title: snapshot.incident.code, what: snapshot.incident.notice, fields: [['State', snapshot.incident.status], ['Scope', `${snapshot.related.length || 0} linked objects`], ['Decision', 'quarantine affected lanterns']], why: 'The recall query matches the M-17 batch token, then preserves the evidence path into each district.' };
  if (node.type === 'district') return { eyebrow: 'DISTRICT', title: district.name, what: district.summary, fields: [['District ID', district.id], ['Affected', `${snapshot.objects.filter((item) => item.district === district.name && affectedIds(snapshot).has(item.id)).length} linked lanterns`], ['Resident', snapshot.residents.find((item) => item.districtId === district.id)?.name || 'unassigned']], why: 'District links answer where an affected object was last seen without requiring a global search.' };
  if (node.type === 'resident') return { eyebrow: 'RESIDENT AGENT', title: resident.name, what: `${resident.role} assigned to this district.`, fields: [['District', snapshot.districts.find((item) => item.id === resident.districtId)?.name || 'unknown'], ['Claims', String(snapshot.claims.filter((item) => item.agentId === resident.id).length)], ['Mode', snapshot.claims.some((item) => item.agentId === resident.id) ? 'working' : 'standing by']], why: 'Ownership is explicit: a task can be resumed by another agent, but a completed claim cannot be silently duplicated.' };
  if (node.type === 'object') {
    const holder = snapshot.residents.find((item) => item.id === object.holderId);
    const events = snapshot.events.filter((event) => event.metadata?.objectId === object.id || event.metadata?.taskId?.includes(object.id));
    return { eyebrow: 'AFFECTED OBJECT', title: object.name, what: object.description, fields: [['Batch', object.batch], ['District', object.district], ['Current holder', holder?.name || object.holderId], ['Status', object.status]], history: events.length ? events.map((event) => event.summary) : ['No action recorded yet.'], why: snapshot.related.find((item) => item.objectId === object.id)?.reason || 'The item is not linked until the deterministic recall query runs.' };
  }
  return { eyebrow: 'CLAIM / TASK', title: node.label, what: `A ${node.action} action for ${node.ownerHint}.`, fields: [['Status', claim?.status || 'available'], ['Task ID', node.taskId], ['Agent', claim ? snapshot.residents.find((item) => item.id === claim.agentId)?.name || claim.agentId : 'unassigned'], ['Checkpoint', claim?.checkpoint || 'not started']], history: snapshot.events.filter((event) => event.metadata?.taskId === node.taskId).map((event) => event.summary), why: claim?.status === 'conflict' ? 'The database rejected a second owner; the first accepted claim remains the winner.' : 'Tasks connect evidence to action, so the UI can show not only what is affected but what should happen next.' };
}
