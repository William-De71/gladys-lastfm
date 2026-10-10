# Gladys Last.fm

External [Gladys Assistant](https://gladysassistant.com) integration for **Last.fm**: what you are listening to,
your scrobbles, music-driven **scenes** and **dashboard widgets**, built on `@gladysassistant/integration-sdk` 0.14.

Last.fm records the tracks played on Spotify, Deezer, Apple Music, YouTube Music, Plex, Sonos and many more: one
integration covers every player that scrobbles.

User documentation: [English](docs/en.md) · [Français](docs/fr.md).

> Community integration, not affiliated with or endorsed by Last.fm.

## Features

### Devices

A device per followed profile (up to 10), offered on the Discovery screen, all features read-only:

| Feature               | Category / type              | Notes                                              |
| --------------------- | ---------------------------- | -------------------------------------------------- |
| Listening             | `music` / `playback_state`   | 1 while a track is playing                         |
| Current or last track | `text` / `text`              | "Artist – Track", never emptied                    |
| Scrobbles today       | `counter-sensor` / `integer` | since midnight in the Gladys time zone (`TZ`)      |
| Total scrobbles       | `counter-sensor` / `integer` | unknown counters are omitted, never published as 0 |

External ids: `ext:<selector>:user:<lowercased username>[:<feature>]`.

### Scene triggers

| Trigger             | Fires when…                                                      | Filters                               |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| `track_started`     | a track that was not playing a reading ago is                    | profile (`source: "devices"`), artist |
| `listening_started` | something plays after nothing                                    | profile                               |
| `listening_stopped` | nothing played for two readings in a row (session length, count) | profile                               |
| `track_loved`       | a track appears on top of the loved tracks                       | profile, artist                       |

The first reading after a start is a baseline (a session in progress does not replay). One `track_started` per
track change: the same track twice in a row is one event.

### Scene actions

`get_now_playing`, `get_stats` (today / total, top artist, album and track over a period), `love_track` and
`unlove_track` (linked account; empty fields = the current or last track).

### Dashboard widgets

| Widget          | Content                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `now_playing`   | cover, title, artist · album, today / total tiles, status, Love/Unlove button, Last.fm link |
| `recent_tracks` | card list (1–8) with covers, dates, "now" and "♥" badges                                    |
| `top_charts`    | top artists / albums (cover grid, up to 12) / tracks over 7 days to all time                |

`now_playing` and `recent_tracks` are nudged (`requestWidgetRefresh`) on every change seen by the watcher.

Cover images: the widget image key encodes the Last.fm image hash (`lf-<hash>-<ext>`), the handler rebuilds the
`lastfm.freetls.fastly.net` URL from validated pieces only (no SSRF, works after a restart), checks the magic
numbers and the 300 KB bound. The grey star placeholder Last.fm returns for every artist since 2019 is treated as
"no image"; GIF covers are skipped (the core does not serve them).

## Configuration

| Key             | Type           | Notes                                                         |
| --------------- | -------------- | ------------------------------------------------------------- |
| `api_key`       | `secret`       | required, 32 hex characters                                   |
| `shared_secret` | `secret`       | only for signed calls (account link, love/unlove)             |
| `usernames`     | `string`       | comma separated, validated against the Last.fm username rules |
| `poll_interval` | `number`       | 15–300 s, default 30                                          |
| `account`       | `account_link` | Last.fm desktop authentication                                |

Internal keys (outside the schema): `session_key`, `session_user`, `last_language`.

Manifest actions: `test_connection`, `unlink_account`.

### Account link

The Last.fm desktop flow maps onto the `account_link` field (a provider that never redirects back):
`auth.getToken` (signed) → the browser opens `https://www.last.fm/api/auth/?api_key=…&token=…` → the integration
polls `auth.getSession` every 3 s (error 14 until approval) for up to 15 minutes, stores the session key (it does
not expire until revoked) and reports it through `setConnectionStatus`. A revoked session (error 9) is cleared on
the next love attempt.

## How it works

Last.fm has no push API. A watcher reads every profile in turn (default every 30 s): `user.getRecentTracks`
(limit 10, extended — current track, loved flags, total), `user.getRecentTracks` from local midnight (today's
count) and `user.getLovedTracks` (limit 5). Three calls per profile per round: 0.3 request/s for three profiles,
far below the Last.fm limit. Widgets and scene actions reuse the last snapshot while it is under 20 s old.

Errors: Last.fm answers `{ error, message }` with a 200 or a 4xx; codes 8, 11, 16, 29, a 5xx and network failures
are retried once. Invalid / suspended keys and bad signatures switch the connection status to disconnected with an
explicit message; a private profile (17) or an unknown one (6) is explained in the widgets.

## Development

```bash
npm install
npm run lint
npm run format:check
npm test
```

The manifest is validated by the core `validateManifest` (v5.1.1 and master): `gladys_version` is `>=5.1.1`
(widgets, scene triggers/actions, `account_link`, `source: "devices"`).

Docker image: `ghcr.io/william-de71/gladys-lastfm`, multi-arch (amd64/arm64), non-root, read-only rootfs. The
package must be public for Gladys to pull it.

## License

Apache-2.0
