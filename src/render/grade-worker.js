// Grades F2's and Moru's sheets away from the main thread (2026-11-13): their 26 million pixels held the page still for
// about 3.4 s on a desktop (longer on a phone) while the loading card turned. The pixels come and go without copying.
import { gradePixels } from './grade.js';

self.onmessage = ({ data: { id, buffer } }) => {
  try { gradePixels(new Uint8ClampedArray(buffer)); self.postMessage({ id, buffer }, [buffer]); }
  catch (error) { self.postMessage({ id, error: String(error?.message || error) }); }
};
