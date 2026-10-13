// Renders integration widget contents the way the Gladys front does
// (front/src/components/boxs/external-widget, ExternalWidgetBox +
// WidgetComponents), in plain DOM, with the same slots, order and class
// names. Only the components these widgets use: text, value, image,
// card-list (list and grid), status, button. The images the core would fetch
// through the integration come from DATA.images.
// Query: ?lang=fr&cards=now_playing,recent_tracks,top_charts&theme=dark
/* global DATA, dayjs, dayjs_plugin_localizedFormat */
const params = new URLSearchParams(location.search);
const LANG = params.get('lang') || 'en';
const CARDS = (params.get('cards') || 'now_playing').split(',');

const text = (value) =>
  value && typeof value === 'object' ? (value[LANG] ?? value.en ?? '') : (value ?? '');
const formatNumber = (value) =>
  typeof value === 'number'
    ? new Intl.NumberFormat(LANG, { maximumFractionDigits: 2 }).format(value)
    : text(value);
// widgetContentUtils.formatDate: dayjs `lll`, a day and a time in the user's
// timezone (render.sh runs Chrome in Europe/Paris).
dayjs.extend(dayjs_plugin_localizedFormat);
const formatDate = (value) => (value ? dayjs(value).locale(LANG).format('lll') : '');
const urlDomain = (url) => (url || '').split('/')[2] || '';
const COLOR = {
  neutral: 'colorNeutral',
  primary: 'colorPrimary',
  success: 'colorSuccess',
  warning: 'colorWarning',
  danger: 'colorDanger',
  info: 'colorInfo',
};
const BADGE_COLOR = {
  primary: 'badgeColorPrimary',
  success: 'badgeColorSuccess',
  warning: 'badgeColorWarning',
  danger: 'badgeColorDanger',
  info: 'badgeColorInfo',
};
const el = (tag, cls, children = []) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const icon = (name, cls = '') => el('i', `fe fe-${name} ${cls}`);

// widgetContentUtils.splitIntoSlots
function splitIntoSlots(components) {
  const slots = { header: [], tiles: [], focal: null, body: null, status: null, buttons: [] };
  for (const c of components) {
    if (c.type === 'text') c.variant === 'body' ? (slots.body = c) : slots.header.push(c);
    else if (c.type === 'value' || c.type === 'gauge') slots.tiles.push(c);
    else if (['chart', 'card-list', 'image'].includes(c.type)) slots.focal = c;
    else if (c.type === 'status') slots.status = c;
    else if (c.type === 'button') slots.buttons.push(c);
  }
  return slots;
}

const header = (components) =>
  el(
    'div',
    'header',
    components.map((c) => el('div', c.variant === 'heading' ? 'heading' : 'caption', text(c.text))),
  );

const tiles = (components) =>
  el(
    'div',
    'tilesBox',
    el(
      'div',
      `tiles tilesCount${Math.min(components.length, 6)}`,
      components.map((c) =>
        el('div', 'tile', [
          c.icon ? icon(c.icon, `tileIcon ${COLOR[c.color] || ''}`) : null,
          el('span', `tileValue ${COLOR[c.color] || ''}`, [
            formatNumber(c.value),
            c.unit ? el('span', 'tileUnit', text(c.unit)) : null,
          ]),
          c.label ? el('span', 'tileLabel', text(c.label)) : null,
        ]),
      ),
    ),
  );

// LazyWidgetImage, once loaded
function image(key, alt, fit) {
  const src = DATA.images[key];
  if (!src) {
    return el('div', 'imageFrame', el('div', 'imagePlaceholder', icon('image')));
  }
  const img = el('img', fit === 'contain' ? 'imageContain' : 'imageCover');
  img.src = src;
  img.alt = text(alt);
  return el('div', 'imageFrame', img);
}

// WidgetCardList: an item with a description or links is clickable; with a
// date, the date replaces the subtitle in the list.
function cardList(component) {
  const grid = component.display === 'grid';
  return el(
    'div',
    null,
    el(
      'div',
      grid ? 'cardGrid' : 'cardList',
      component.items.map((item) => {
        const clickable = Boolean(item.description) || (item.links && item.links.length > 0);
        const meta = item.date ? formatDate(item.date) : text(item.subtitle);
        const node = el(
          'button',
          `${grid ? 'cardGridItem' : 'cardListItem'} ${clickable ? 'clickable' : ''}`,
          [
            item.image ? image(item.image, item.title, 'cover') : null,
            el('div', 'cardListText', [
              el('span', 'cardTitle', text(item.title)),
              meta ? el('span', 'cardMeta', meta) : null,
              item.badge
                ? el('span', `wbadge ${BADGE_COLOR[item.badge.color] || ''}`, text(item.badge.text))
                : null,
            ]),
          ],
        );
        node.type = 'button';
        node.disabled = !clickable;
        return node;
      }),
    ),
  );
}

const statusList = (component) =>
  el(
    'ul',
    'statusList',
    component.items.map((item) =>
      el('li', 'statusRow', [
        item.icon
          ? icon(item.icon, `statusIcon ${COLOR[item.color || 'neutral']}`)
          : el('span', `statusDot ${COLOR[item.color || 'neutral']}`),
        el('span', 'statusLabel', text(item.label)),
        el('span', 'statusValue', formatNumber(item.value)),
      ]),
    ),
  );

// WidgetButtons: a link shows its domain, an action its icon
const buttons = (components) =>
  el(
    'div',
    'buttons',
    components.map((c) => {
      const cls = `button ${c.style === 'primary' ? 'buttonPrimary' : ''} ${c.style === 'danger' ? 'buttonDanger' : ''}`;
      if (c.link) {
        const node = el('a', cls, [
          el('span', 'buttonIcon', icon(c.icon || 'external-link')),
          el('span', 'buttonLabel', text(c.label)),
          el('span', 'buttonDomain', `(${urlDomain(c.link.url)})`),
        ]);
        node.href = c.link.url;
        return node;
      }
      const node = el('button', cls, [
        el('span', 'buttonIcon', icon(c.icon || 'play')),
        el('span', 'buttonLabel', text(c.label)),
      ]);
      node.type = 'button';
      return node;
    }),
  );

function card(name) {
  const content = DATA.contents[LANG][name];
  const { icon: cardIcon, label } = DATA.cards[name];
  const slots = splitIntoSlots(content.components);
  const focal = slots.focal;
  return el('div', 'card', [
    el(
      'div',
      'card-header',
      el('h3', 'card-title', [icon(cardIcon || 'grid'), el('span', 'm-1', text(label))]),
    ),
    el(
      'div',
      'card-body',
      el('div', 'slots', [
        slots.header.length ? header(slots.header) : null,
        slots.tiles.length ? tiles(slots.tiles) : null,
        focal && focal.type === 'card-list' ? cardList(focal) : null,
        focal && focal.type === 'image' ? image(focal.key, focal.alt, focal.fit) : null,
        slots.body ? el('p', 'body', text(slots.body.text)) : null,
        slots.status ? statusList(slots.status) : null,
        slots.buttons.length ? buttons(slots.buttons) : null,
      ]),
    ),
  ]);
}

const row = document.getElementById('row');
for (const name of CARDS) {
  row.append(el('div', 'col', card(name)));
}
document.body.dataset.ready = '1';
