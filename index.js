// -----------------------------------------------------------------------------
// Entry point of the Last.fm external integration.
//
// Last.fm records what people listen to, whatever the player (Spotify, Deezer,
// Apple Music, Plex, a turntable app…): one "scrobble" per track. This
// integration follows one or more profiles and brings their listening into
// Gladys:
//   - a device per profile (Discovery screen): listening or not, the current
//     or last track, today's and total scrobbles (see device.js);
//   - scene triggers: listening started / stopped, a new track (filter on the
//     artist), a track loved (see tracker.js, events.js);
//   - scene actions: what is playing, the listening statistics, love / unlove
//     a track (see scene-actions.js);
//   - dashboard widgets: now playing, recent tracks, top charts (widgets.js).
//
// Reading needs a free Last.fm API key. Loving a track needs a linked account:
// the `account` Connect button runs the Last.fm desktop authentication (see
// account.js). Last.fm has no push API: the profiles are read on a loop
// (see watcher.js), every 30 seconds by default.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the time zone of Gladys: "today" for the daily counter)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  isLinkedUser,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './src/config.js';
import {
  createLastfmClient,
  buildUserAgent,
  ERROR_CODES,
  CONFIG_ERROR_CODES,
} from './src/lastfm-api.js';
import { createWatcher } from './src/watcher.js';
import { createAccountLinker } from './src/account.js';
import { buildDevice, buildStates, idsOf, usernameFromExternalId } from './src/device.js';
import { buildSceneEvent } from './src/events.js';
import { readTrack, readUser } from './src/tracks.js';
import { imageUrlFromKey } from './src/images.js';
import { t, all, LANGUAGES } from './src/i18n.js';
import {
  SCENE_ACTIONS,
  buildNowPlayingOutputs,
  buildStatsOutputs,
  loveTarget,
} from './src/scene-actions.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  TOP_PERIODS,
  messageContent,
  readTopSettings,
  buildNowPlayingWidget,
  buildRecentTracksWidget,
  buildTopWidget,
} from './src/widgets.js';

const { name, version, homepage } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

const ACCOUNT_FIELD = 'account';
const ACTIONS = { TEST_CONNECTION: 'test_connection', UNLINK_ACCOUNT: 'unlink_account' };
// A widget or a scene action reuses the last round while it is this fresh.
const SNAPSHOT_MAX_AGE_MS = 20000;

const gladys = new GladysIntegration();

let config = normalizeConfig();
// Language of the last widget request: the fallback of the texts Gladys does
// not ask for in a language, when the `language` setting is `auto`.
let language = 'en';
// Device external ids the user created (states are only published for them).
let createdDevices = new Set();
// Last connection status sent, to send it again only when it changes.
let lastStatus = null;

const lastfm = createLastfmClient({
  getCredentials: () => ({ apiKey: config.apiKey, sharedSecret: config.sharedSecret }),
  getUserAgent: () => buildUserAgent({ name, version, homepage }),
});

/**
 * @description Remember the language of a request, and store it when it changed.
 * @param {string} next - The language.
 * @example
 * rememberLanguage('fr');
 */
function rememberLanguage(next) {
  if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
    return;
  }
  language = next;
  gladys
    .setConfig({ [INTERNAL_KEYS.language]: next })
    .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
}

/**
 * @description Language of the texts Gladys does not ask for in a language
 * (device names, scene summaries and outputs): the `language` setting, or the
 * language of the last widget request when it is `auto`.
 * @returns {string} The language.
 */
function textLanguage() {
  return config.language === AUTO_LANGUAGE ? language : config.language;
}

/**
 * @description Report the connection status, only when it changed.
 * @param {boolean} connected - Connected or not.
 * @param {object} message - The multi-language message.
 * @returns {Promise<void>}
 */
async function reportStatus(connected, message) {
  const signature = JSON.stringify([connected, message]);
  if (signature === lastStatus) {
    return;
  }
  lastStatus = signature;
  try {
    await gladys.setConnectionStatus(connected, message);
  } catch (err) {
    lastStatus = null;
    logger.error('Unable to report the connection status', err);
  }
}

/**
 * @description The status message of a working connection.
 * @returns {object} The multi-language message.
 */
function connectedMessage() {
  return config.sessionKey && config.sessionUser
    ? all('statusLinked', { user: config.sessionUser })
    : all('statusReadOnly');
}

/**
 * @description Refresh the list of the devices the user created.
 * @returns {Promise<void>}
 */
async function refreshCreatedDevices() {
  try {
    const devices = await gladys.getDevices();
    createdDevices = new Set(devices.map((device) => device.external_id));
  } catch (err) {
    logger.warn(`Unable to read the devices: ${err.message}`);
  }
}

/**
 * @description Publish the states of a profile, when its device exists.
 * @param {string} username - The username.
 * @param {object} snapshot - Its snapshot.
 * @returns {Promise<void>}
 */
async function publishStates(username, snapshot) {
  if (!createdDevices.has(idsOf(gladys, username).device)) {
    return;
  }
  await gladys.publishStates(buildStates(gladys, username, snapshot));
}

// --- The watcher -----------------------------------------------------------------
const watcher = createWatcher({
  lastfm,
  getUsernames: () => (config.apiKey ? config.usernames : []),
  getIntervalMs: () => config.pollInterval * 1000,
  onRound: async (username, snapshot, { events, changed }) => {
    for (const event of events) {
      const { key, data } = buildSceneEvent(gladys, username, event, textLanguage());
      logger.info(`${username}: ${key} (${data.artist} – ${data.track})`);
      try {
        await gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Unable to publish the scene event ${key}: ${err.message}`);
      }
    }
    if (changed) {
      await publishStates(username, snapshot);
      gladys.requestWidgetRefresh(WIDGETS.NOW_PLAYING);
      gladys.requestWidgetRefresh(WIDGETS.RECENT_TRACKS);
    }
  },
  onRoundEnd: async ({ errors }) => {
    if (!config.apiKey) {
      await reportStatus(false, all('noApiKey'));
      return;
    }
    if (errors.some((err) => CONFIG_ERROR_CODES.has(err.code))) {
      await reportStatus(false, all('statusInvalidKey'));
      return;
    }
    if (errors.length > 0 && errors.length === config.usernames.length) {
      if (errors.every((err) => err.code === 0 || err.status >= 500)) {
        await reportStatus(false, all('statusUnreachable'));
        return;
      }
    }
    if (config.usernames.length > 0) {
      await reportStatus(true, connectedMessage());
    }
  },
  logger,
});

/**
 * @description Check the API key when no profile is followed (the rounds do
 * it otherwise).
 * @returns {Promise<void>}
 */
async function verifyKeyAlone() {
  if (!config.apiKey) {
    await reportStatus(false, all('noApiKey'));
    return;
  }
  if (config.usernames.length > 0) {
    return;
  }
  try {
    await lastfm.call('chart.getTopArtists', { limit: 1 });
    await reportStatus(true, connectedMessage());
  } catch (err) {
    await reportStatus(
      false,
      all(CONFIG_ERROR_CODES.has(err.code) ? 'statusInvalidKey' : 'statusUnreachable'),
    );
  }
}

/**
 * @description Offer a device per followed profile on the Discovery screen,
 * spelled as Last.fm spells the username. A profile that does not exist is
 * left out (and logged).
 * @returns {Promise<number>} How many devices were offered.
 */
async function publishDiscoveredDevices() {
  if (!config.apiKey) {
    await gladys.publishDiscoveredDevices([]);
    return 0;
  }
  const devices = [];
  for (const username of config.usernames) {
    try {
      const profile = readUser(await lastfm.getUserInfo(username));
      devices.push(buildDevice(gladys, profile.name || username, textLanguage()));
    } catch (err) {
      if (err.code === ERROR_CODES.INVALID_PARAMETERS) {
        logger.warn(`Last.fm profile "${username}" not found: not offered`);
      } else {
        // Last.fm unreachable: offer it anyway, as typed.
        logger.warn(`Unable to check the Last.fm profile ${username}: ${err.message}`);
        devices.push(buildDevice(gladys, username, textLanguage()));
      }
    }
  }
  await gladys.publishDiscoveredDevices(devices);
  return devices.length;
}

// --- Account link ----------------------------------------------------------------
const linker = createAccountLinker({
  lastfm,
  onLinked: async (session) => {
    await gladys.setConfig({
      [INTERNAL_KEYS.sessionKey]: session.key,
      [INTERNAL_KEYS.sessionUser]: session.name,
    });
    config = { ...config, sessionKey: session.key, sessionUser: session.name };
    await reportStatus(true, connectedMessage());
    gladys.requestWidgetRefresh(WIDGETS.NOW_PLAYING);
  },
  logger,
});

gladys.onOAuthAuthorizeUrl(async (key) => {
  if (key !== ACCOUNT_FIELD) {
    throw new Error(`Unknown account field: ${key}`);
  }
  try {
    return await linker.start();
  } catch (err) {
    logger.error(`Unable to start the Last.fm account link: ${err.message}`);
    throw err;
  }
});

/**
 * @description Love or unlove a track as the linked account.
 * @param {{ artist: string, track: string }} target - The track.
 * @param {boolean} love - false to unlove.
 * @returns {Promise<void>}
 * @throws {Error} Without a linked account.
 */
async function setLove(target, love) {
  if (!config.sessionKey) {
    throw new Error(t('notLinked', 'en'));
  }
  try {
    await lastfm.setLove({ ...target, sessionKey: config.sessionKey, love });
  } catch (err) {
    if (err.code === ERROR_CODES.INVALID_SESSION) {
      logger.warn('The Last.fm session was revoked: link the account again');
      config = { ...config, sessionKey: '', sessionUser: '' };
      await gladys
        .setConfig({ [INTERNAL_KEYS.sessionKey]: '', [INTERNAL_KEYS.sessionUser]: '' })
        .catch(() => {});
      await reportStatus(true, connectedMessage());
    }
    throw err;
  }
  // The "loved" flag changed: read the profile again for the widgets.
  if (config.sessionUser && config.usernames.length > 0) {
    const followed = config.usernames.find((user) => isLinkedUser(config, user));
    if (followed) {
      watcher.refresh(followed).catch(() => {});
    }
  }
}

// --- Profiles of the widgets and scene actions -------------------------------------

/**
 * @description The profile a widget or a scene action targets.
 * @param {unknown} deviceExternalId - The `source: "devices"` value.
 * @param {object} [options] - Options.
 * @param {boolean} [options.preferLinked] - Default to the linked account.
 * @returns {string|null} The username, null when none is followed.
 */
function resolveUsername(deviceExternalId, { preferLinked = false } = {}) {
  const chosen = usernameFromExternalId(deviceExternalId, config.usernames);
  if (chosen) {
    return chosen;
  }
  if (preferLinked && config.sessionUser) {
    return config.usernames.find((user) => isLinkedUser(config, user)) ?? config.sessionUser;
  }
  return config.usernames[0] ?? null;
}

/**
 * @description The message of a failed profile read, for a widget.
 * @param {Error} err - The error.
 * @param {string} username - The username.
 * @param {string} lang - The language.
 * @returns {string} The message.
 */
function readErrorMessage(err, username, lang) {
  if (err.code === ERROR_CODES.LOGIN_REQUIRED) {
    return t('privateProfile', lang, { user: username });
  }
  if (err.code === ERROR_CODES.INVALID_PARAMETERS) {
    return t('unknownUser', lang, { user: username });
  }
  if (CONFIG_ERROR_CODES.has(err.code)) {
    return t('statusInvalidKey', lang);
  }
  return t('unavailable', lang);
}

/**
 * @description Resolve the profile of a widget and its snapshot, or the
 * content explaining why there is none.
 * @param {object} settings - The widget settings.
 * @param {string} lang - The user language.
 * @returns {Promise<{ username: string, snapshot: object }|{ content: object }>} The context.
 */
async function widgetProfile(settings, lang) {
  if (!config.apiKey) {
    return { content: messageContent(t('noApiKey', lang)) };
  }
  const username = resolveUsername(settings.user);
  if (!username) {
    return { content: messageContent(t('noUser', lang)) };
  }
  try {
    return { username, snapshot: await watcher.get(username, SNAPSHOT_MAX_AGE_MS) };
  } catch (err) {
    logger.warn(`Widget: unable to read ${username}: ${err.message}`);
    return { content: messageContent(readErrorMessage(err, username, lang), 60) };
  }
}

// --- Dashboard widgets -------------------------------------------------------------
gladys.onWidgetGet(WIDGETS.NOW_PLAYING, async ({ settings = {}, language: lang }) => {
  rememberLanguage(lang);
  const context = await widgetProfile(settings, lang);
  if (context.content) {
    return context.content;
  }
  return buildNowPlayingWidget({
    snapshot: context.snapshot,
    language: lang,
    canLove: isLinkedUser(config, context.username),
    now: Date.now(),
  });
});

gladys.onWidgetAction(WIDGETS.NOW_PLAYING, async (actionKey, params) => {
  const target = { artist: String(params.artist ?? ''), track: String(params.track ?? '') };
  if (!target.artist || !target.track) {
    throw new Error('No track to love');
  }
  if (!config.sessionKey) {
    return all('notLinked');
  }
  const love = actionKey === WIDGET_ACTIONS.LOVE;
  await setLove(target, love);
  return all(love ? 'lovedToast' : 'unlovedToast', {
    track: `${target.artist} – ${target.track}`,
  });
});

gladys.onWidgetGet(WIDGETS.RECENT_TRACKS, async ({ settings = {}, language: lang }) => {
  rememberLanguage(lang);
  const context = await widgetProfile(settings, lang);
  if (context.content) {
    return context.content;
  }
  return buildRecentTracksWidget({ snapshot: context.snapshot, language: lang, settings });
});

gladys.onWidgetGet(WIDGETS.TOP_CHARTS, async ({ settings = {}, language: lang }) => {
  rememberLanguage(lang);
  if (!config.apiKey) {
    return messageContent(t('noApiKey', lang));
  }
  const username = resolveUsername(settings.user);
  if (!username) {
    return messageContent(t('noUser', lang));
  }
  const { kind, period, count } = readTopSettings(settings);
  try {
    const entries = (await lastfm.getTop(username, kind, period, count))
      .map(readTrack)
      .filter((entry) => entry.name)
      .slice(0, count);
    return buildTopWidget({ username, entries, kind, period, language: lang });
  } catch (err) {
    logger.warn(`Widget: unable to read the charts of ${username}: ${err.message}`);
    return messageContent(readErrorMessage(err, username, lang), 60);
  }
});

// Image keys encode the Last.fm cover they stand for (see images.js): the URL
// is rebuilt from validated pieces, so only a Last.fm cover can be fetched.
gladys.onWidgetGetImage(async (imageKey) => {
  const url = imageUrlFromKey(imageKey);
  if (url === null) {
    throw new Error(`Unknown image key: ${imageKey}`);
  }
  return lastfm.fetchImage(url);
});

// --- Scene actions -----------------------------------------------------------------

/**
 * @description The profile and fresh snapshot of a scene action.
 * @param {unknown} deviceExternalId - The "Profile" field.
 * @returns {Promise<object>} The snapshot.
 * @throws {Error} When no profile is followed.
 */
async function sceneSnapshot(deviceExternalId) {
  const username = resolveUsername(deviceExternalId);
  if (!username) {
    throw new Error('No Last.fm profile is configured');
  }
  return watcher.get(username, SNAPSHOT_MAX_AGE_MS);
}

gladys.onSceneAction(SCENE_ACTIONS.GET_NOW_PLAYING, async (fields) =>
  buildNowPlayingOutputs(await sceneSnapshot(fields.user), textLanguage()),
);

gladys.onSceneAction(SCENE_ACTIONS.GET_STATS, async (fields) => {
  const snapshot = await sceneSnapshot(fields.user);
  const period = TOP_PERIODS.includes(fields.period) ? fields.period : TOP_PERIODS[0];
  const top = async (kind) => {
    try {
      const [first] = await lastfm.getTop(snapshot.username, kind, period, 1);
      return first ? readTrack(first) : null;
    } catch (err) {
      logger.warn(`Top ${kind} of ${snapshot.username} unavailable: ${err.message}`);
      return null;
    }
  };
  const [topArtist, topAlbum, topTrack] = await Promise.all([
    top('artists'),
    top('albums'),
    top('tracks'),
  ]);
  return buildStatsOutputs({
    snapshot,
    topArtist,
    topAlbum,
    topTrack,
    period,
    language: textLanguage(),
  });
});

/**
 * @description Run a love/unlove scene action.
 * @param {object} fields - The action fields.
 * @param {boolean} love - false to unlove.
 * @returns {Promise<object>} The outputs `{ artist, track }`.
 */
async function loveAction(fields, love) {
  if (!config.sessionKey) {
    throw new Error('No Last.fm account is linked: link one in the integration settings');
  }
  let snapshot = null;
  const linked = config.usernames.find((user) => isLinkedUser(config, user));
  if (!(fields.artist && fields.track)) {
    snapshot = await watcher.get(linked ?? config.sessionUser, SNAPSHOT_MAX_AGE_MS);
  }
  const target = loveTarget(fields, snapshot);
  if (!target) {
    throw new Error('No track to love: give an artist and a track');
  }
  await setLove(target, love);
  return target;
}

gladys.onSceneAction(SCENE_ACTIONS.LOVE_TRACK, (fields) => loveAction(fields, true));
gladys.onSceneAction(SCENE_ACTIONS.UNLOVE_TRACK, (fields) => loveAction(fields, false));

// --- Configuration screen actions --------------------------------------------------
gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
  if (!config.apiKey) {
    return all('noApiKey');
  }
  if (config.usernames.length === 0) {
    await lastfm.call('chart.getTopArtists', { limit: 1 });
    return all('keyAccepted');
  }
  const lines = [];
  for (const username of config.usernames) {
    try {
      const profile = readUser(await lastfm.getUserInfo(username));
      lines.push(
        all('profileOk', { user: profile.name || username, count: profile.playcount ?? '?' }),
      );
    } catch (err) {
      lines.push(
        all('profileError', (lang) => ({
          user: username,
          error: readErrorMessage(err, username, lang),
        })),
      );
    }
  }
  if (config.sessionUser) {
    lines.push(all('linkedAccount', { user: config.sessionUser }));
  }
  return Object.fromEntries(
    LANGUAGES.map((lang) => [lang, lines.map((line) => line[lang]).join(' · ')]),
  );
});

gladys.onAction(ACTIONS.UNLINK_ACCOUNT, async () => {
  linker.cancel();
  await gladys.setConfig({ [INTERNAL_KEYS.sessionKey]: '', [INTERNAL_KEYS.sessionUser]: '' });
  config = { ...config, sessionKey: '', sessionUser: '' };
  await reportStatus(Boolean(config.apiKey), config.apiKey ? connectedMessage() : all('noApiKey'));
  gladys.requestWidgetRefresh(WIDGETS.NOW_PLAYING);
  return all('unlinked');
});

// --- Devices -----------------------------------------------------------------------
gladys.onScanRequest(async () => {
  const count = await publishDiscoveredDevices();
  logger.info(`Scan: ${count} Last.fm profile(s) offered`);
});

gladys.onDeviceCreated(async (device) => {
  await refreshCreatedDevices();
  const username = usernameFromExternalId(device.external_id, config.usernames);
  const snapshot = username ? watcher.peek(username) : null;
  if (snapshot) {
    // States sent before the device existed were dropped by Gladys: send
    // them again now, and refresh the widgets that pick this profile.
    await publishStates(username, snapshot).catch((err) =>
      logger.warn(`Unable to publish the states of ${username}: ${err.message}`),
    );
    gladys.requestWidgetRefresh(WIDGETS.NOW_PLAYING);
    gladys.requestWidgetRefresh(WIDGETS.RECENT_TRACKS);
  }
});

gladys.onDeviceDeleted(refreshCreatedDevices);

// --- Configuration -----------------------------------------------------------------

/**
 * @description Reload the whole config (internal keys included).
 * @param {object} [fallback] - Raw values to use when the read fails.
 * @returns {Promise<void>}
 */
async function loadConfig(fallback) {
  try {
    const raw = await gladys.getConfig();
    config = normalizeConfig(raw);
    language = readLanguage(raw, language);
  } catch (err) {
    if (fallback) {
      config = {
        ...normalizeConfig(fallback),
        sessionKey: config.sessionKey,
        sessionUser: config.sessionUser,
      };
    }
    logger.error('Unable to read the configuration', err);
  }
}

gladys.onConfigUpdated(async (rawConfig) => {
  await loadConfig(rawConfig);
  logger.info(
    `Configuration updated: ${config.usernames.length} profile(s), read every ${config.pollInterval} s`,
  );
  watcher.prune();
  watcher.reschedule();
  await verifyKeyAlone();
  await publishDiscoveredDevices().catch((err) =>
    logger.warn(`Unable to offer the devices: ${err.message}`),
  );
  watcher.round().catch(() => {});
});

// --- Connection lifecycle ----------------------------------------------------------
// Each step on its own: a failing one must not keep the watcher from starting.
gladys.on('connected', async () => {
  await loadConfig();
  await refreshCreatedDevices();
  lastStatus = null;
  await verifyKeyAlone();
  await publishDiscoveredDevices().catch((err) =>
    logger.warn(`Unable to offer the devices: ${err.message}`),
  );
  watcher.start();
});

// --- Graceful shutdown -------------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  watcher.stop();
  linker.cancel();
});

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Last.fm integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
