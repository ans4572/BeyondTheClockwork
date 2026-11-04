// Talks to the transfer API (worker/index.js): leave the save under a short code, or fetch one left by another device.
import { normalizeCode } from '../engine/transfer-code.js';

const WORKER_ORIGIN = 'https://beyondtheclockwork.ans4572.workers.dev';
/** The Cloudflare copy answers the API itself; GitHub Pages and local play borrow it. */
export const apiBase = (hostname = location.hostname) => (hostname.endsWith('workers.dev') ? '' : WORKER_ORIGIN);

/** One plain sentence for each way a transfer can fail. */
const PROBLEMS = {
  rate: '코드를 너무 많이 만들었어요. 한 시간 뒤에 다시 해 주세요.',
  missing: '이 코드를 찾을 수 없어요. 글자를 확인하거나, 5분이 지났다면 새 코드를 만들어 주세요.',
  bad: '저장 내용을 보낼 수 없어요.',
  unavailable: '기기 이동 서버가 아직 준비되지 않았어요.',
  server: '서버에 문제가 생겼어요. 잠시 뒤 다시 해 주세요.',
  network: '인터넷에 연결되어 있는지 확인해 주세요.',
  typed: '코드는 8글자예요 (예: K7Q4-MZPA).'
};
export class TransferError extends Error {}
const fail = reason => { throw new TransferError(PROBLEMS[reason] || PROBLEMS.server); };

async function call(path, options = {}, fetchImpl = fetch, base = apiBase()) {
  let response;
  try { response = await fetchImpl(base + path, { ...options, headers: { 'Content-Type': 'application/json' } }); } catch { fail('network'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(body.error);
  return body;
}
/** Leaves the save on the server; answers { code, expiresAt }. */
export const sendSave = (save, fetchImpl, base) => call('/api/transfer', { method: 'POST', body: JSON.stringify({ save }) }, fetchImpl, base);
/** The save another device left under this code, as the raw saved text. */
export async function fetchSave(typed, fetchImpl, base) {
  const code = normalizeCode(typed);
  if (!code) fail('typed');
  return { code, save: (await call(`/api/transfer/${code}`, {}, fetchImpl, base)).save };
}
/** A used code is removed so it cannot be loaded twice; failing to remove it only means it expires on its own. */
export const forgetCode = (code, fetchImpl, base) => call(`/api/transfer/${code}`, { method: 'DELETE' }, fetchImpl, base).catch(() => {});
