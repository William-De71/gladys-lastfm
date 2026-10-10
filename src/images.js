// -----------------------------------------------------------------------------
// Cover images of the widgets.
//
// A widget refers to an image by a key (`^[a-z0-9][a-z0-9-]{0,63}$`); the core
// asks for its bytes through onWidgetGetImage and caches them one hour per
// key. Last.fm covers live at
//   https://lastfm.freetls.fastly.net/i/u/<size>/<32 hex hash>.<ext>
// The key encodes the hash and the extension ("lf-2a96…-png"): the handler
// rebuilds the URL from the key alone — after a restart too — and can only
// ever fetch a Last.fm cover, never an arbitrary URL.
//
// Last.fm stopped serving artist pictures in 2019: every artist (and most top
// tracks) carries the same grey star placeholder, which is treated as "no
// image" rather than shown a dozen times.
// -----------------------------------------------------------------------------

const IMAGE_HOST = 'https://lastfm.freetls.fastly.net';
const IMAGE_SIZE = '300x300';
const IMAGE_URL_REGEX = /\/i\/u\/(?:[^/]+\/)?([0-9a-f]{32})\.(png|jpe?g|webp)$/i;
const IMAGE_KEY_REGEX = /^lf-([0-9a-f]{32})-(png|jpg|jpeg|webp)$/;
const PLACEHOLDER_HASHES = new Set(['2a96cbd8b46e442fc41c2b86b821562f']);

/**
 * @description Pick the largest image URL of a Last.fm `image` array.
 * @param {Array<{ size: string, '#text': string }>|undefined} images - The array.
 * @returns {string|null} The URL, null when there is none.
 * @example
 * largestImage([{ size: 'small', '#text': 'https://…/34s/abc.png' }]);
 */
function largestImage(images) {
  if (!Array.isArray(images)) {
    return null;
  }
  const withUrl = images.filter((image) => typeof image?.['#text'] === 'string' && image['#text']);
  return withUrl.length > 0 ? withUrl[withUrl.length - 1]['#text'] : null;
}

/**
 * @description Turn a Last.fm cover URL into a widget image key.
 * @param {string|null} url - The cover URL.
 * @returns {string|null} The key, null for no image, a placeholder or a URL
 * that is not a Last.fm cover (a GIF too: the core does not serve them).
 * @example
 * imageKeyFromUrl('https://lastfm.freetls.fastly.net/i/u/300x300/0123456789abcdef0123456789abcdef.jpg');
 * // -> 'lf-0123456789abcdef0123456789abcdef-jpg'
 */
function imageKeyFromUrl(url) {
  if (typeof url !== 'string') {
    return null;
  }
  const match = IMAGE_URL_REGEX.exec(url);
  if (!match) {
    return null;
  }
  const hash = match[1].toLowerCase();
  if (PLACEHOLDER_HASHES.has(hash)) {
    return null;
  }
  return `lf-${hash}-${match[2].toLowerCase()}`;
}

/**
 * @description Rebuild the cover URL of a widget image key.
 * @param {string} key - The key.
 * @returns {string|null} The URL, null for a key this integration never produced.
 * @example
 * imageUrlFromKey('lf-0123456789abcdef0123456789abcdef-jpg');
 * // -> 'https://lastfm.freetls.fastly.net/i/u/300x300/0123456789abcdef0123456789abcdef.jpg'
 */
function imageUrlFromKey(key) {
  const match = IMAGE_KEY_REGEX.exec(String(key));
  if (!match) {
    return null;
  }
  return `${IMAGE_HOST}/i/u/${IMAGE_SIZE}/${match[1]}.${match[2]}`;
}

export { largestImage, imageKeyFromUrl, imageUrlFromKey };
