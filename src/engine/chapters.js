// The story's chapters (slice.json chapters). Chapter 1, 웃음거리, keeps its rooms in slice.json rooms, where they always
// were; every later chapter lists its own rooms. An expedition belongs to one chapter (run.chapter), chosen with the
// difficulty at the town portal; a run saved before chapters existed is a chapter 1 run.
export const FIRST_CHAPTER = 'smile-street';

/** Every chapter in order. Data without a chapter list is chapter 1 alone. */
export const chapterList = slice => slice.chapters?.length ? slice.chapters : [{ id: FIRST_CHAPTER, number: 1, name: '웃음거리' }];
/** One chapter by id; an unknown or missing id is chapter 1. */
export const chapterOf = (slice, id) => chapterList(slice).find(chapter => chapter.id === id) || chapterList(slice)[0];
/** The stops of a chapter, in order. */
export const chapterRooms = (slice, id) => chapterOf(slice, id).rooms || slice.rooms;
/** Every room of every chapter (data checks, map lookups). */
export const allRooms = slice => chapterList(slice).flatMap(chapter => chapterRooms(slice, chapter.id));

/**
 * True once the player has beaten a chapter's last boss. Chapter 1 also counts as beaten for saves from before
 * chapters were kept (profile.cleared): a win, or the ending already seen.
 */
export function chapterCleared(profile, id) {
  if (profile?.cleared?.includes(id)) return true;
  return id === FIRST_CHAPTER && ((profile?.wins || 0) > 0 || !!profile?.bossTalks?.includes('ending'));
}
/** A chapter opens once the one it follows (chapters[].after) is beaten. */
export const chapterOpen = (slice, profile, id) => { const after = chapterOf(slice, id).after; return !after || chapterCleared(profile, after); };

/** Marks a chapter beaten in the save. */
export function clearChapter(profile, id) {
  const cleared = profile.cleared ??= [];
  if (!cleared.includes(id)) cleared.push(id);
}

/** Where a chapter's clear records live in the save: chapter 1 in profile.records, as before; later ones beside it. */
export function chapterRecords(profile, id) {
  if (!id || id === FIRST_CHAPTER) return profile.records ??= {};
  return (profile.chapterRecords ??= {})[id] ??= {};
}
