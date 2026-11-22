/**
 * A room's name as players read it: the trailing layout letter (A to D) is for the editor only, and a room with a
 * `floor` (chapter 3's tower, "1층" to "꼭대기") carries it in front, so the climb reads in every title (2026-11-15).
 */
export const roomTitle = room => `${room.floor ? `${room.floor} · ` : ''}${room.name.replace(/ [A-Z]$/, '')}`;
