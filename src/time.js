// -----------------------------------------------------------------------------
// Local dates and times.
//
// The supervisor starts the container with `TZ` set to the time zone of
// Gladys: "today" (the daily scrobble counter) and the times written in the
// scene outputs follow it. Intl does the time zone arithmetic, so the result
// does not depend on the tzdata of the image.
// -----------------------------------------------------------------------------

const LOCALES = { fr: 'fr-FR', en: 'en-GB' };

/**
 * @description The time zone of Gladys (UTC when unknown or invalid).
 * @returns {string} The IANA time zone.
 * @example
 * gladysTimeZone(); // -> 'Europe/Paris'
 */
function gladysTimeZone() {
  const zone = process.env.TZ;
  if (zone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone });
      return zone;
    } catch {
      return 'UTC';
    }
  }
  return 'UTC';
}

/**
 * @description The wall-clock fields of an instant in a time zone.
 * @param {number} instant - The instant, in ms.
 * @param {string} timeZone - The IANA time zone.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 * The fields.
 */
function wallClock(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

/**
 * @description The offset of a time zone at an instant.
 * @param {number} instant - The instant, in ms.
 * @param {string} timeZone - The IANA time zone.
 * @returns {number} Local time minus UTC, in ms.
 */
function offsetAt(instant, timeZone) {
  const wall = wallClock(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * @description The instant of the last local midnight (DST-safe).
 * @param {number} now - Now, in ms.
 * @param {string} [timeZone] - The IANA time zone.
 * @returns {number} The instant of midnight, in ms.
 * @example
 * startOfDay(Date.parse('2026-10-11T10:00:00Z'), 'Europe/Paris'); // -> Date.parse('2026-10-10T22:00:00Z')
 */
function startOfDay(now, timeZone = gladysTimeZone()) {
  const wall = wallClock(now, timeZone);
  const midnightAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day);
  let instant = midnightAsUtc - offsetAt(midnightAsUtc, timeZone);
  // A second pass absorbs a DST change between midnight and the guess.
  instant = midnightAsUtc - offsetAt(instant, timeZone);
  return instant;
}

/**
 * @description Format an instant as a local date and time, for a scene output.
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - The IANA time zone.
 * @returns {string} e.g. '11/10/2026 14:05'.
 * @example
 * formatDateTime(Date.now(), 'fr');
 */
function formatDateTime(instant, language, timeZone = gladysTimeZone()) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(instant));
}

export { gladysTimeZone, startOfDay, formatDateTime };
