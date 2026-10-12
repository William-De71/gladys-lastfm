// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Last.fm – {user}',
    fr: 'Last.fm – {user}',
    de: 'Last.fm – {user}',
    es: 'Last.fm – {user}',
  },
  featurePlaying: { en: 'Listening', fr: 'En écoute', de: 'Hört gerade', es: 'Escuchando' },
  featureNowPlaying: {
    en: 'Current or last track',
    fr: 'Titre en cours ou dernier titre',
    de: 'Aktueller oder letzter Titel',
    es: 'Canción actual o última',
  },
  featureToday: {
    en: 'Scrobbles today',
    fr: 'Scrobbles du jour',
    de: 'Scrobbles heute',
    es: 'Scrobbles de hoy',
  },
  featureTotal: {
    en: 'Total scrobbles',
    fr: 'Scrobbles au total',
    de: 'Scrobbles insgesamt',
    es: 'Scrobbles en total',
  },

  // widgets
  listening: { en: 'Listening now', fr: 'En écoute', de: 'Hört gerade', es: 'Escuchando' },
  stopped: { en: 'Not listening', fr: 'À l’arrêt', de: 'Pausiert', es: 'Sin reproducir' },
  status: { en: 'Status', fr: 'État', de: 'Status', es: 'Estado' },
  lastPlayed: {
    en: 'Last played',
    fr: 'Dernière écoute',
    de: 'Zuletzt gehört',
    es: 'Última escucha',
  },
  loved: { en: 'Loved', fr: 'Coup de cœur', de: 'Lieblingstitel', es: 'Favorita' },
  yes: { en: 'Yes', fr: 'Oui', de: 'Ja', es: 'Sí' },
  today: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  total: { en: 'Total', fr: 'Au total', de: 'Insgesamt', es: 'En total' },
  scrobbles: { en: 'scrobbles', fr: 'scrobbles', de: 'Scrobbles', es: 'scrobbles' },
  love: { en: 'Love', fr: 'J’aime', de: 'Lieben', es: 'Me encanta' },
  unlove: { en: 'Unlove', fr: 'Je n’aime plus', de: 'Nicht mehr lieben', es: 'Ya no me encanta' },
  openLastfm: {
    en: 'Open on Last.fm',
    fr: 'Voir sur Last.fm',
    de: 'Auf Last.fm öffnen',
    es: 'Abrir en Last.fm',
  },
  nowBadge: { en: 'Now', fr: 'En cours', de: 'Jetzt', es: 'Ahora' },
  lovedBadge: { en: '♥', fr: '♥', de: '♥', es: '♥' },
  plays: { en: '{n} plays', fr: '{n} écoutes', de: '{n}× gehört', es: '{n} escuchas' },
  recentOf: {
    en: 'Recent tracks of {user}',
    fr: 'Écoutes récentes de {user}',
    de: 'Zuletzt gehört von {user}',
    es: 'Escuchas recientes de {user}',
  },
  topOf: {
    en: '{kind} of {user} · {period}',
    fr: '{kind} de {user} · {period}',
    de: '{kind} von {user} · {period}',
    es: '{kind} de {user} · {period}',
  },
  topArtists: { en: 'Top artists', fr: 'Top artistes', de: 'Top-Künstler', es: 'Top artistas' },
  topAlbums: { en: 'Top albums', fr: 'Top albums', de: 'Top-Alben', es: 'Top álbumes' },
  topTracks: { en: 'Top tracks', fr: 'Top titres', de: 'Top-Titel', es: 'Top canciones' },
  period_7day: {
    en: 'last 7 days',
    fr: '7 derniers jours',
    de: 'letzte 7 Tage',
    es: 'últimos 7 días',
  },
  period_1month: { en: 'last month', fr: 'dernier mois', de: 'letzter Monat', es: 'último mes' },
  period_3month: {
    en: 'last 3 months',
    fr: '3 derniers mois',
    de: 'letzte 3 Monate',
    es: 'últimos 3 meses',
  },
  period_6month: {
    en: 'last 6 months',
    fr: '6 derniers mois',
    de: 'letzte 6 Monate',
    es: 'últimos 6 meses',
  },
  period_12month: {
    en: 'last 12 months',
    fr: '12 derniers mois',
    de: 'letzte 12 Monate',
    es: 'últimos 12 meses',
  },
  period_overall: {
    en: 'all time',
    fr: 'depuis toujours',
    de: 'gesamte Zeit',
    es: 'desde siempre',
  },
  nothingYet: {
    en: '{user} has not scrobbled anything yet.',
    fr: '{user} n’a encore rien scrobblé.',
    de: '{user} hat noch nichts gescrobbelt.',
    es: '{user} aún no ha hecho ningún scrobble.',
  },
  emptyChart: {
    en: 'Nothing to show for this period yet.',
    fr: 'Rien à afficher pour cette période pour l’instant.',
    de: 'Für diesen Zeitraum gibt es noch nichts anzuzeigen.',
    es: 'Todavía no hay nada que mostrar para este periodo.',
  },
  noUser: {
    en: 'No Last.fm profile is configured: add one in the integration settings.',
    fr: 'Aucun profil Last.fm n’est configuré : ajoutez-en un dans les réglages de l’intégration.',
    de: 'Kein Last.fm-Profil konfiguriert: Füge eines in der Konfiguration der Integration hinzu.',
    es: 'No hay ningún perfil de Last.fm configurado: añade uno en la configuración de la integración.',
  },
  noApiKey: {
    en: 'Enter your Last.fm API key in the integration settings.',
    fr: 'Renseignez votre clé d’API Last.fm dans les réglages de l’intégration.',
    de: 'Gib deinen Last.fm-API-Schlüssel in der Konfiguration der Integration ein.',
    es: 'Introduce tu clave de API de Last.fm en la configuración de la integración.',
  },
  privateProfile: {
    en: '{user} hides their recent listening on Last.fm (privacy settings).',
    fr: '{user} masque ses écoutes récentes sur Last.fm (réglages de confidentialité).',
    de: '{user} verbirgt die zuletzt gehörten Titel auf Last.fm (Datenschutzeinstellungen).',
    es: '{user} oculta sus escuchas recientes en Last.fm (ajustes de privacidad).',
  },
  unknownUser: {
    en: 'The Last.fm profile "{user}" does not exist.',
    fr: 'Le profil Last.fm « {user} » n’existe pas.',
    de: 'Das Last.fm-Profil „{user}“ existiert nicht.',
    es: 'El perfil de Last.fm «{user}» no existe.',
  },
  unavailable: {
    en: 'Last.fm is not answering right now.',
    fr: 'Last.fm ne répond pas pour le moment.',
    de: 'Last.fm antwortet gerade nicht.',
    es: 'Last.fm no responde en este momento.',
  },
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },

  // widget actions
  lovedToast: {
    en: 'Loved: {track}',
    fr: 'Ajouté aux coups de cœur : {track}',
    de: 'Zu den Lieblingstiteln hinzugefügt: {track}',
    es: 'Añadida a favoritas: {track}',
  },
  unlovedToast: {
    en: 'No longer loved: {track}',
    fr: 'Retiré des coups de cœur : {track}',
    de: 'Aus den Lieblingstiteln entfernt: {track}',
    es: 'Quitada de favoritas: {track}',
  },
  notLinked: {
    en: 'Link your Last.fm account in the integration settings first.',
    fr: 'Liez d’abord votre compte Last.fm dans les réglages de l’intégration.',
    de: 'Verknüpfe zuerst dein Last.fm-Konto in der Konfiguration der Integration.',
    es: 'Vincula primero tu cuenta de Last.fm en la configuración de la integración.',
  },

  // scene summaries
  summaryPlaying: {
    en: '{user} is listening to {track}.',
    fr: '{user} écoute {track}.',
    de: '{user} hört {track}.',
    es: '{user} está escuchando {track}.',
  },
  summaryLast: {
    en: '{user} is not listening; last track: {track}.',
    fr: '{user} n’écoute rien ; dernier titre : {track}.',
    de: '{user} hört gerade nichts; letzter Titel: {track}.',
    es: '{user} no está escuchando nada; última canción: {track}.',
  },
  summaryNothing: {
    en: '{user} has no track yet.',
    fr: '{user} n’a encore aucun titre.',
    de: '{user} hat noch keinen Titel.',
    es: '{user} todavía no tiene ninguna canción.',
  },
  summaryTrackStarted: {
    en: '{user} is listening to {track}.',
    fr: '{user} écoute {track}.',
    de: '{user} hört {track}.',
    es: '{user} está escuchando {track}.',
  },
  summaryListeningStarted: {
    en: '{user} started listening: {track}.',
    fr: '{user} a commencé à écouter : {track}.',
    de: '{user} hat angefangen zu hören: {track}.',
    es: '{user} ha empezado a escuchar: {track}.',
  },
  summaryListeningStopped: {
    en: '{user} stopped listening after {minutes} min ({count} tracks).',
    fr: '{user} a arrêté d’écouter après {minutes} min ({count} titres).',
    de: '{user} hat nach {minutes} Min. aufgehört zu hören ({count} Titel).',
    es: '{user} ha dejado de escuchar tras {minutes} min ({count} canciones).',
  },
  summaryLoved: {
    en: '{user} loved {track}.',
    fr: '{user} a aimé {track}.',
    de: '{user} liebt {track}.',
    es: 'A {user} le encanta {track}.',
  },
  summaryStats: {
    en: '{user}: {today} scrobbles today, {total} in total. Top artist ({period}): {artist}.',
    fr: '{user} : {today} scrobbles aujourd’hui, {total} au total. Artiste préféré ({period}) : {artist}.',
    de: '{user}: {today} Scrobbles heute, {total} insgesamt. Top-Künstler ({period}): {artist}.',
    es: '{user}: {today} scrobbles hoy, {total} en total. Artista favorito ({period}): {artist}.',
  },

  // configuration screen
  keyAccepted: {
    en: 'API key accepted. No profile followed yet.',
    fr: 'Clé d’API acceptée. Aucun profil suivi pour l’instant.',
    de: 'API-Schlüssel akzeptiert. Noch kein Profil abonniert.',
    es: 'Clave de API aceptada. Todavía no sigues ningún perfil.',
  },
  profileOk: {
    en: '{user}: OK, {count} scrobbles',
    fr: '{user} : OK, {count} scrobbles',
    de: '{user}: OK, {count} Scrobbles',
    es: '{user}: OK, {count} scrobbles',
  },
  profileError: {
    en: '{user}: {error}',
    fr: '{user} : {error}',
    de: '{user}: {error}',
    es: '{user}: {error}',
  },
  linkedAccount: {
    en: 'Linked account: {user}',
    fr: 'Compte lié : {user}',
    de: 'Verknüpftes Konto: {user}',
    es: 'Cuenta vinculada: {user}',
  },
  unlinked: {
    en: 'Account unlinked. You can also revoke the access in your Last.fm settings (Applications).',
    fr: 'Compte délié. Vous pouvez aussi révoquer l’accès dans vos réglages Last.fm (Applications).',
    de: 'Konto getrennt. Du kannst den Zugriff auch in deinen Last.fm-Einstellungen (Anwendungen) widerrufen.',
    es: 'Cuenta desvinculada. También puedes revocar el acceso en tus ajustes de Last.fm (Aplicaciones).',
  },

  // connection status
  statusReadOnly: {
    en: 'Connected to Last.fm. Link an account to love tracks.',
    fr: 'Connecté à Last.fm. Liez un compte pour aimer des titres.',
    de: 'Mit Last.fm verbunden. Verknüpfe ein Konto, um Titel zu lieben.',
    es: 'Conectado a Last.fm. Vincula una cuenta para marcar canciones como favoritas.',
  },
  statusLinked: {
    en: 'Connected to Last.fm, account {user} linked.',
    fr: 'Connecté à Last.fm, compte {user} lié.',
    de: 'Mit Last.fm verbunden, Konto {user} verknüpft.',
    es: 'Conectado a Last.fm, cuenta {user} vinculada.',
  },
  statusInvalidKey: {
    en: 'Last.fm refuses the API key: check it in the settings.',
    fr: 'Last.fm refuse la clé d’API : vérifiez-la dans les réglages.',
    de: 'Last.fm lehnt den API-Schlüssel ab: Prüfe ihn in der Konfiguration.',
    es: 'Last.fm rechaza la clave de API: revísala en la configuración.',
  },
  statusUnreachable: {
    en: 'Last.fm cannot be reached; retrying.',
    fr: 'Last.fm est injoignable ; nouvel essai en cours.',
    de: 'Last.fm ist nicht erreichbar; neuer Versuch läuft.',
    es: 'No se puede contactar con Last.fm; reintentando.',
  },
};

/**
 * @description Whether a language is one of the integration.
 * @param {unknown} language - The language.
 * @returns {boolean} True for en, fr, de, es.
 * @example
 * isLanguage('de'); // -> true
 */
function isLanguage(language) {
  return LANGUAGES.includes(language);
}

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
 * @param {object|Function} [values] - The substitutions, or
 * `(language) => substitutions` when they depend on the language.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusLinked', { user: 'rj' });
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
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

export { LANGUAGES, TEXTS, isLanguage, t, all, ago };
