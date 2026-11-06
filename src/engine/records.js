// Clear records per difficulty: the fastest clear, the element pair it was cleared with, how many clears, and how far
// the furthest expedition got. Kept in the save (profile.records) and, for the whole server, read from the runs the
// statistics already keep (worker/stats.js records). Shown on the difficulty cards before setting out (main.js).
import { DIFFICULTIES, ELEMENT_IDS } from './stats.js';

/** A clear faster than this is not a real run (a hand-made request); the server's board leaves it out. */
export const MIN_CLEAR_SECONDS = 240;

const emptyRecord = () => ({ best: null, elements: [], clears: 0, furthest: 0 });
const elementsOk = list => Array.isArray(list) && list.length <= 2 && list.every(id => ELEMENT_IDS.includes(id));
const whole = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

/** One expedition back from the road: a clear may set a new best; any run may reach further than before. */
export function noteRecord(records, { reason, difficulty = 'normal', node, elapsed, elements = [] }) {
  if (!DIFFICULTIES.includes(difficulty)) return records;
  const record = records[difficulty] ??= emptyRecord();
  if (Number.isInteger(node)) record.furthest = Math.max(record.furthest, node);
  if (reason === 'clear' && Number.isFinite(elapsed)) {
    const seconds = Math.round(elapsed);
    record.clears++;
    if (record.best === null || seconds < record.best) { record.best = seconds; record.elements = elements.filter(id => ELEMENT_IDS.includes(id)); }
  }
  return records;
}

/**
 * A save's records made safe: anything odd is dropped rather than refusing the save. A save from before records
 * existed starts from its last ten expeditions (profile.history), so a player who already cleared sees it.
 */
export function cleanRecords(records, history = []) {
  const clean = {};
  if (records && typeof records === 'object') {
    for (const id of DIFFICULTIES) {
      const r = records[id];
      if (!r || typeof r !== 'object') continue;
      clean[id] = {
        best: whole(r.best, 864000) ? r.best : null,
        elements: elementsOk(r.elements) ? [...r.elements] : [],
        clears: whole(r.clears, 1e9) ? r.clears : 0,
        furthest: whole(r.furthest, 99) ? r.furthest : 0
      };
    }
    return clean;
  }
  for (const result of [...history].reverse()) if (result && typeof result === 'object') noteRecord(clean, result);
  return clean;
}

/** This device's own best: the save's record, or the server's if it knows a better one (a run on a since-cleared save). */
export function mergeMine(local = emptyRecord(), server) {
  if (!server) return local;
  const serverBetter = server.best !== null && (local.best === null || server.best < local.best);
  return {
    best: serverBetter ? server.best : local.best,
    elements: serverBetter ? server.elements : local.elements,
    clears: Math.max(local.clears, server.clears || 0),
    furthest: Math.max(local.furthest, server.furthest || 0)
  };
}

/** 754 seconds → '12:34'; past an hour '1:02:03'. */
export function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** 'fire+ice' (the statistics' combo key) → ['fire', 'ice']. */
export const comboElements = combo => (typeof combo === 'string' && combo ? combo.split('+').filter(id => ELEMENT_IDS.includes(id)) : []);
