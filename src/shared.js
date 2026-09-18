/**
 * Shared constants and helpers.
 * Loaded first by the content script, and via <script> by the options and popup pages.
 * No modules: content scripts share one isolated scope, so these are plain globals.
 */

/** Used when the page names no colour, or names something that is not a colour. */
const IF_ENV_FALLBACK_COLOUR = '#2d3034';

/**
 * Accept `#abc` or `#aabbcc`, with or without the hash, and return a normalised `#aabbcc`.
 * Strict on purpose: this value ends up in a CSS custom property, so anything that is not
 * exactly six hex digits is refused rather than sanitised.
 */
function ifEnvHex(value) {
  const text = String(value === null || value === undefined ? '' : value).trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]{3}$/.test(text) && !/^[0-9a-f]{6}$/.test(text)) return null;
  const full = text.length === 3 ? text.replace(/./g, (c) => c + c) : text;
  return `#${full}`;
}

function ifEnvRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, which decides whether text on this colour is white or near-black. */
function ifEnvLuminance(hex) {
  const [r, g, b] = ifEnvRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The tag we read. Fixed, so a page and the extension cannot disagree about the name. */
const IF_ENV_META_NAME = 'if-env-info';

/** Both spellings, so a page written either way works without anyone debugging a grey banner. */
const IF_ENV_COLOUR_KEYS = new Set(['colour', 'color']);

/**
 * Fields listed here lead the banner; everything else follows in the order the page sent it.
 * These are also exactly the keys with an icon, which is not a coincidence: a key we can mark
 * with a glyph is one we know the meaning of, so it is one we can also place deliberately.
 */
const IF_ENV_KEY_ORDER = ['environment', 'app', 'worktree'];

const IF_ENV_SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Lucide icons, stored as shape data rather than markup so they can be built with
 * createElementNS. Nothing here is ever parsed as HTML, which keeps the banner's
 * "no innerHTML anywhere" rule intact even though these strings are ours, not the page's.
 */
const IF_ENV_ICONS = {
  // lucide/cloud
  environment: [
    ['path', { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' }],
  ],
  // lucide/app-window-mac
  app: [
    ['rect', { width: '20', height: '16', x: '2', y: '4', rx: '2' }],
    ['path', { d: 'M6 8h.01' }],
    ['path', { d: 'M10 8h.01' }],
    ['path', { d: 'M14 8h.01' }],
  ],
  // lucide/folder-git-2
  worktree: [
    ['path', { d: 'M18 19a5 5 0 0 1-5-5v8' }],
    ['path', { d: 'M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5' }],
    ['circle', { cx: '13', cy: '12', r: '2' }],
    ['circle', { cx: '20', cy: '19', r: '2' }],
  ],
};

/** Build an icon for a key, or null for a key we have no glyph for. Strokes follow the text. */
function ifEnvIcon(key) {
  const shapes = IF_ENV_ICONS[key];
  if (!shapes) return null;
  const svg = document.createElementNS(IF_ENV_SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  for (const [tag, attrs] of shapes) {
    const shape = document.createElementNS(IF_ENV_SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) shape.setAttribute(name, value);
    svg.append(shape);
  }
  return svg;
}

/**
 * One field of the bar: an icon and the value, or the key in words when we have no icon for it.
 * Shared with the settings preview so the two cannot drift.
 *
 * An icon replaces the key on screen but not for a screen reader, which still gets the key from
 * the visually hidden span — an icon-only label is exactly the case where that matters.
 */
function ifEnvFieldNode(key, value) {
  const wrap = document.createElement('span');
  wrap.className = 'field';
  const icon = ifEnvIcon(key.toLowerCase());

  if (icon) {
    wrap.classList.add(`is-${key.toLowerCase()}`);
    wrap.title = key;
    wrap.append(icon);
    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = `${key}: `;
    wrap.append(sr);
  } else {
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = key;
    wrap.append(k);
  }

  const v = document.createElement('span');
  v.className = 'v';
  v.textContent = value;
  wrap.append(v);
  return wrap;
}

const IF_ENV_DEFAULTS = {
  enabled: true,
  scope: 'all',                 // 'all' | 'allowlist'
  patterns: ['*.test', '*.dev', 'localhost', '127.0.0.1'],
  position: 'top',              // 'top' | 'bottom'
  pushContent: true,
  size: 'small',                // 'small' | 'large' | 'xl'
};

/**
 * The three banner sizes, as the custom properties the bar is built from. Keyed by the CSS
 * property name so the banner and the settings preview can apply the same map without either
 * one restating the numbers.
 */
const IF_ENV_SIZES = {
  small: {
    '--if-env-h': '30px',
    '--if-env-fs': '12px',
    '--if-env-mono': '11.5px',
    '--if-env-pad': '12px',
    '--if-env-gap': '14px',
    '--if-env-icon': '14px',
  },
  large: {
    '--if-env-h': '40px',
    '--if-env-fs': '14px',
    '--if-env-mono': '13px',
    '--if-env-pad': '16px',
    '--if-env-gap': '18px',
    '--if-env-icon': '17px',
  },
  xl: {
    '--if-env-h': '52px',
    '--if-env-fs': '17px',
    '--if-env-mono': '15.5px',
    '--if-env-pad': '20px',
    '--if-env-gap': '22px',
    '--if-env-icon': '20px',
  },
};

/**
 * The bar's drop shadow, keyed by position so it falls away from the page rather than into it.
 * Kept here, like IF_ENV_SIZES, so the banner and the settings preview cannot drift apart.
 */
const IF_ENV_SHADOWS = {
  top: '0 2px 5px rgba(0, 0, 0, .18), 0 6px 18px rgba(0, 0, 0, .12)',
  bottom: '0 -2px 5px rgba(0, 0, 0, .18), 0 -6px 18px rgba(0, 0, 0, .12)',
};

/** Look up a shadow, falling back to top for a position we do not know. */
function ifEnvShadowFor(position) {
  return IF_ENV_SHADOWS[position] || IF_ENV_SHADOWS.top;
}

/** Apply a size to an element, falling back to small for a name we do not know. */
function ifEnvApplySize(el, size) {
  const chosen = IF_ENV_SIZES[size] || IF_ENV_SIZES.small;
  for (const [prop, value] of Object.entries(chosen)) el.style.setProperty(prop, value);
}

/** Page-supplied values are untrusted: cap how much of them we will ever handle. */
const IF_ENV_LIMITS = { fields: 12, extra: 30, key: 40, value: 200 };

/**
 * A reserved key whose value is a nested object of detail. It never reaches the bar — the bar is
 * a glance, and this is the stuff you go looking for — so it is shown only in the popup, and the
 * cap is looser than the bar's because nothing has to fit on one line.
 */
const IF_ENV_EXTRA_KEY = 'extra';

async function ifEnvGetSettings() {
  let stored = {};
  try {
    stored = (await chrome.storage.sync.get('settings')).settings || {};
  } catch (e) {
    // Storage unavailable (e.g. profile locked); fall through to defaults.
  }
  const settings = { ...IF_ENV_DEFAULTS, ...stored };
  return settings;
}

function ifEnvSaveSettings(settings) {
  return chrome.storage.sync.set({ settings });
}

function ifEnvEscapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Glob match against a hostname. `*` matches any run of characters. */
function ifEnvHostMatches(hostname, patterns) {
  const host = String(hostname || '').toLowerCase();
  return (patterns || []).some((raw) => {
    const pattern = String(raw).trim().toLowerCase();
    if (!pattern) return false;
    const source = pattern.split('*').map(ifEnvEscapeRegExp).join('.*');
    try {
      return new RegExp(`^${source}$`).test(host);
    } catch (e) {
      return false;
    }
  });
}

/**
 * Take the usable string/number pairs off an object, trimmed and capped. Anything nested, empty
 * or absent is dropped rather than coerced, so `{}` and `[1,2]` cannot become a row reading
 * "[object Object]". Shared by the top-level fields and the nested `extra` object.
 */
function ifEnvTakePairs(source, max) {
  const out = {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(source)) {
    if (count >= max) break;
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue === 'object') continue;
    const key = String(rawKey).trim().slice(0, IF_ENV_LIMITS.key);
    const value = String(rawValue).trim().slice(0, IF_ENV_LIMITS.value);
    if (!key || !value) continue;
    out[key] = value;
    count += 1;
  }
  return out;
}

/**
 * Parse the meta tag's content.
 * Returns { fields, extra } on success, { error } when the JSON is unusable, or null when empty.
 */
function ifEnvParse(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: 'meta tag is not valid JSON' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'meta tag must contain a JSON object' };
  }

  // `extra` is reserved whatever it holds: a page that sends a string under that name gets no
  // detail table rather than a stray bar field with a confusing name.
  const extraEntry = Object.entries(data)
    .find(([key]) => String(key).trim().toLowerCase() === IF_ENV_EXTRA_KEY);
  const top = { ...data };
  if (extraEntry) delete top[extraEntry[0]];

  const source = extraEntry && extraEntry[1];
  const usable = source && typeof source === 'object' && !Array.isArray(source);

  const fields = ifEnvTakePairs(top, IF_ENV_LIMITS.fields);
  const extra = usable ? ifEnvTakePairs(source, IF_ENV_LIMITS.extra) : {};

  if (!Object.keys(fields).length && !Object.keys(extra).length) {
    return { error: 'meta tag has no readable values' };
  }
  return { fields, extra };
}

/**
 * Build the banner's colours from the single hex the page supplied. The text colour is derived
 * rather than configured, so a page only has to know one colour and cannot pick an unreadable
 * pairing against it.
 */
function ifEnvPaletteFor(colour) {
  const bg = ifEnvHex(colour) || IF_ENV_FALLBACK_COLOUR;
  // 0.18 is where white and near-black text have equal contrast against a background.
  const light = ifEnvLuminance(bg) > 0.18;
  return {
    bg,
    fg: light ? '#141719' : '#ffffff',
  };
}

/** Order fields: IF_ENV_KEY_ORDER first, then whatever else the page sent, as it sent it. */
function ifEnvOrderedFields(fields) {
  const order = IF_ENV_KEY_ORDER;
  const keys = Object.keys(fields);
  keys.sort((a, b) => {
    const ia = order.indexOf(a.toLowerCase());
    const ib = order.indexOf(b.toLowerCase());
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return keys.map((k) => [k, fields[k]]);
}
