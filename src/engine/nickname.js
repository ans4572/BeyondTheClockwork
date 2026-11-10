// The name the player gives in Moru's repair ledger. F2 is the product number on the disposal form; until a name is
// written in the ledger (or when it is left blank) the player is called by that number.

export const NICKNAME_MAX = 10;
export const PRODUCT_NUMBER = 'F2';

/** A name as the ledger keeps it: letters (any script), digits, spaces and - _ . only, at most NICKNAME_MAX long. */
export function cleanNickname(text) {
  if (typeof text !== 'string') return '';
  const kept = text.normalize('NFC').replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/ +/g, ' ').trim();
  return [...kept].slice(0, NICKNAME_MAX).join('').trim();
}

/** What the player is called: the ledger name, or the product number. */
export const callName = profile => cleanNickname(profile?.nickname) || PRODUCT_NUMBER;

/**
 * Whether a word ends in a final consonant (받침) when read aloud, for picking 이라고/라고, 이에요/예요 and the like.
 * Hangul syllables are read directly; digits by their Korean names (영 일 이 삼 사 오 육 칠 팔 구); Latin letters by
 * their usual Korean reading (L M N R end in a consonant: 엘 엠 엔 알).
 */
export function endsInConsonant(word) {
  const last = [...String(word).trim()].at(-1) || '';
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(last)) return '013678'.includes(last);
  if (/[a-z]/i.test(last)) return 'lmnr'.includes(last.toLowerCase());
  return false;
}

/**
 * Fills a dialogue line: {name} becomes the player's name, and {name|이라고|라고} the name with the particle that fits
 * (the first form after a final consonant, the second after a vowel).
 */
/**
 * A word with the particle that fits it (2026-11-10: notices showed 이(가), 을(를) as written): josa('로코', '이', '가')
 * gives 로코가, josa('굉음', '을', '를') gives 굉음을.
 */
export const josa = (word, consonant, vowel) => `${word}${endsInConsonant(word) ? consonant : vowel}`;

export const fillName = (text, profile) => String(text).replace(/\{name(?:\|([^|}]*)\|([^}]*))?\}/g, (_, consonant, vowel) => {
  const name = callName(profile);
  return consonant === undefined ? name : name + (endsInConsonant(name) ? consonant : vowel);
});
