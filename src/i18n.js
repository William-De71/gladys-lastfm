// -----------------------------------------------------------------------------
// Texts of the integration, in English and French (English fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen.
// -----------------------------------------------------------------------------

const TEXTS = {
  // devices
  deviceName: { en: 'Last.fm – {user}', fr: 'Last.fm – {user}' },
  featurePlaying: { en: 'Listening', fr: 'En écoute' },
  featureNowPlaying: { en: 'Current or last track', fr: 'Titre en cours ou dernier titre' },
  featureToday: { en: 'Scrobbles today', fr: 'Scrobbles du jour' },
  featureTotal: { en: 'Total scrobbles', fr: 'Scrobbles au total' },

  // widgets
  listening: { en: 'Listening now', fr: 'En écoute' },
  stopped: { en: 'Not listening', fr: 'À l’arrêt' },
  status: { en: 'Status', fr: 'État' },
  lastPlayed: { en: 'Last played', fr: 'Dernière écoute' },
  loved: { en: 'Loved', fr: 'Coup de cœur' },
  yes: { en: 'Yes', fr: 'Oui' },
  today: { en: 'Today', fr: 'Aujourd’hui' },
  total: { en: 'Total', fr: 'Au total' },
  scrobbles: { en: 'scrobbles', fr: 'scrobbles' },
  love: { en: 'Love', fr: 'J’aime' },
  unlove: { en: 'Unlove', fr: 'Je n’aime plus' },
  openLastfm: { en: 'Open on Last.fm', fr: 'Voir sur Last.fm' },
  nowBadge: { en: 'Now', fr: 'En cours' },
  lovedBadge: { en: '♥', fr: '♥' },
  plays: { en: '{n} plays', fr: '{n} écoutes' },
  recentOf: { en: 'Recent tracks of {user}', fr: 'Écoutes récentes de {user}' },
  topOf: { en: '{kind} of {user} · {period}', fr: '{kind} de {user} · {period}' },
  topArtists: { en: 'Top artists', fr: 'Top artistes' },
  topAlbums: { en: 'Top albums', fr: 'Top albums' },
  topTracks: { en: 'Top tracks', fr: 'Top titres' },
  period_7day: { en: 'last 7 days', fr: '7 derniers jours' },
  period_1month: { en: 'last month', fr: 'dernier mois' },
  period_3month: { en: 'last 3 months', fr: '3 derniers mois' },
  period_6month: { en: 'last 6 months', fr: '6 derniers mois' },
  period_12month: { en: 'last 12 months', fr: '12 derniers mois' },
  period_overall: { en: 'all time', fr: 'depuis toujours' },
  nothingYet: {
    en: '{user} has not scrobbled anything yet.',
    fr: '{user} n’a encore rien scrobblé.',
  },
  emptyChart: {
    en: 'Nothing to show for this period yet.',
    fr: 'Rien à afficher pour cette période pour l’instant.',
  },
  noUser: {
    en: 'No Last.fm profile is configured: add one in the integration settings.',
    fr: 'Aucun profil Last.fm n’est configuré : ajoutez-en un dans les réglages de l’intégration.',
  },
  noApiKey: {
    en: 'Enter your Last.fm API key in the integration settings.',
    fr: 'Renseignez votre clé d’API Last.fm dans les réglages de l’intégration.',
  },
  privateProfile: {
    en: '{user} hides their recent listening on Last.fm (privacy settings).',
    fr: '{user} masque ses écoutes récentes sur Last.fm (réglages de confidentialité).',
  },
  unknownUser: {
    en: 'The Last.fm profile "{user}" does not exist.',
    fr: 'Le profil Last.fm « {user} » n’existe pas.',
  },
  unavailable: {
    en: 'Last.fm is not answering right now.',
    fr: 'Last.fm ne répond pas pour le moment.',
  },
  ago_now: { en: 'just now', fr: 'à l’instant' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j' },

  // widget actions
  lovedToast: { en: 'Loved: {track}', fr: 'Ajouté aux coups de cœur : {track}' },
  unlovedToast: { en: 'No longer loved: {track}', fr: 'Retiré des coups de cœur : {track}' },
  notLinked: {
    en: 'Link your Last.fm account in the integration settings first.',
    fr: 'Liez d’abord votre compte Last.fm dans les réglages de l’intégration.',
  },

  // scene summaries
  summaryPlaying: { en: '{user} is listening to {track}.', fr: '{user} écoute {track}.' },
  summaryLast: {
    en: '{user} is not listening; last track: {track}.',
    fr: '{user} n’écoute rien ; dernier titre : {track}.',
  },
  summaryNothing: { en: '{user} has no track yet.', fr: '{user} n’a encore aucun titre.' },
  summaryTrackStarted: { en: '{user} is listening to {track}.', fr: '{user} écoute {track}.' },
  summaryListeningStarted: {
    en: '{user} started listening: {track}.',
    fr: '{user} a commencé à écouter : {track}.',
  },
  summaryListeningStopped: {
    en: '{user} stopped listening after {minutes} min ({count} tracks).',
    fr: '{user} a arrêté d’écouter après {minutes} min ({count} titres).',
  },
  summaryLoved: { en: '{user} loved {track}.', fr: '{user} a aimé {track}.' },
  summaryStats: {
    en: '{user}: {today} scrobbles today, {total} in total. Top artist ({period}): {artist}.',
    fr: '{user} : {today} scrobbles aujourd’hui, {total} au total. Artiste préféré ({period}) : {artist}.',
  },

  // connection status
  statusReadOnly: {
    en: 'Connected to Last.fm. Link an account to love tracks.',
    fr: 'Connecté à Last.fm. Liez un compte pour aimer des titres.',
  },
  statusLinked: {
    en: 'Connected to Last.fm, account {user} linked.',
    fr: 'Connecté à Last.fm, compte {user} lié.',
  },
  statusInvalidKey: {
    en: 'Last.fm refuses the API key: check it in the settings.',
    fr: 'Last.fm refuse la clé d’API : vérifiez-la dans les réglages.',
  },
  statusUnreachable: {
    en: 'Last.fm cannot be reached; retrying.',
    fr: 'Last.fm est injoignable ; nouvel essai en cours.',
  },
};

/**
 * @description Pick a text in a language (English fallback), with `{name}`
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('summaryPlaying', 'fr', { user: 'rj', track: 'Daft Punk – One More Time' });
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string }} The message.
 * @example
 * all('statusLinked', { user: 'rj' });
 */
function all(key, values = {}) {
  return { en: t(key, 'en', values), fr: t(key, 'fr', values) };
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 * @example
 * ago(Date.now() - 600000, Date.now(), 'en'); // -> '10 min ago'
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { TEXTS, t, all, ago };
