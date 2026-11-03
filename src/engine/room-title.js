/** A room's name as players read it: the trailing layout letter (A to D) is for the editor only. */
export const roomTitle = room => room.name.replace(/ [A-Z]$/, '');
