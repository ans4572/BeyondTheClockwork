// Talks to the device API (worker/index.js): transfer codes that carry one copy of the save, and sync keys that keep
// linked devices on the newest progress.
import { normalizeCode } from '../engine/transfer-code.js';

const WORKER_ORIGIN = 'https://beyondtheclockwork.mungaeng.workers.dev';
/** The Cloudflare copy answers the API itself; GitHub Pages and local play borrow it. */
export const apiBase = (hostname = location.hostname) => (hostname.endsWith('workers.dev') ? '' : WORKER_ORIGIN);

/** One plain sentence for each way a request can fail. */
const PROBLEMS = {
  rate: '코드를 너무 많이 만들었어요. 한 시간 뒤에 다시 해 주세요.',
  missing: '이 코드를 찾을 수 없어요. 글자를 확인하거나, 5분이 지났다면 새 코드를 만들어 주세요.',
  unlinked: '동기화 정보를 찾을 수 없어요. 오래 쓰지 않아 지워졌을 수 있어요. 동기화를 다시 켜 주세요.',
  conflict: '다른 기기에서 먼저 올린 진행이 있어요. 게임을 다시 열면 어느 쪽을 쓸지 고를 수 있어요.',
  bad: '저장 내용을 보낼 수 없어요.',
  unavailable: '기기 연동 서버가 아직 준비되지 않았어요.',
  server: '서버에 문제가 생겼어요. 잠시 뒤 다시 해 주세요.',
  network: '인터넷에 연결되어 있는지 확인해 주세요.',
  typed: '코드는 8글자예요 (예: K7Q4-MZPA).'
};
/** `reason` is the server's word for the failure (conflict, unlinked, network…), for callers that act on it. */
export class TransferError extends Error { constructor(reason) { super(PROBLEMS[reason] || PROBLEMS.server); this.reason = reason; } }
const fail = reason => { throw new TransferError(reason); };

async function call(path, options = {}, fetchImpl = fetch, base = apiBase()) {
  let response;
  try { response = await fetchImpl(base + path, { ...options, headers: { 'Content-Type': 'application/json' } }); } catch { fail('network'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(body.error);
  return body;
}
const post = (method, body) => ({ method, body: JSON.stringify(body) });

/** Leaves the save on the server under a five-minute code; a sync key sent along links the receiving device too. */
export const sendSave = (save, fetchImpl, base, syncKey) => call('/api/transfer', post('POST', syncKey ? { save, syncKey } : { save }), fetchImpl, base);
/** What another device left under this code: { code, save, syncKey? }. */
export async function fetchSave(typed, fetchImpl, base) {
  const code = normalizeCode(typed);
  if (!code) fail('typed');
  const held = await call(`/api/transfer/${code}`, {}, fetchImpl, base);
  return { code, save: held.save, syncKey: held.syncKey };
}
/** A used code is removed so it cannot be loaded twice; failing to remove it only means it expires on its own. */
export const forgetCode = (code, fetchImpl, base) => call(`/api/transfer/${code}`, { method: 'DELETE' }, fetchImpl, base).catch(() => {});

/** Starts syncing from this device: { key, rev }. */
export const startSync = (save, fetchImpl, base) => call('/api/sync', post('POST', { save }), fetchImpl, base);
/** The newest synced save: { rev, save, at }. */
export const pullSync = (key, fetchImpl, base) => call(`/api/sync/${key}`, {}, fetchImpl, base);
/** Uploads over revision `baseRev`: { rev }, or a TransferError with reason 'conflict' if another device got there first. */
export const pushSync = (key, save, baseRev, fetchImpl, base) => call(`/api/sync/${key}`, post('PUT', { save, baseRev }), fetchImpl, base);
