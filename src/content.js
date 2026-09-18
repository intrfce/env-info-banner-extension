/**
 * Reads <meta name="if-env-info" content='{"environment":"staging", ...}'> and renders a banner.
 *
 * Everything on the page is untrusted input: values are only ever written with textContent,
 * and the banner lives in a shadow root so page CSS cannot restyle it (and ours cannot leak).
 */
(() => {
  const HOST_TAG = 'if-env-info-banner';

  let settings = null;
  let state = { reason: 'starting', parsed: null, error: null };
  let host = null;
  let shadow = null;
  let nodes = null;
  let lastSerialised = null;
  let observers = [];

  /* ------------------------------------------------------------------ reading */

  function metaContent(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute('content') : null;
  }

  function readMeta() {
    const raw = metaContent(IF_ENV_META_NAME);
    if (raw === null) return null;
    const parsed = ifEnvParse(raw);
    if (parsed && parsed.error) parsed.raw = String(raw).slice(0, 200);
    return parsed;
  }

  /* ------------------------------------------------------------------ building */

  function build() {
    if (host && host.isConnected) return;

    host = document.createElement(HOST_TAG);
    host.setAttribute('aria-hidden', 'false');
    shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS_TEXT;
    shadow.append(style);

    const bar = document.createElement('div');
    bar.className = 'bar';

    const fields = document.createElement('span');
    fields.className = 'fields';

    bar.append(fields);

    shadow.append(bar);
    nodes = { bar, fields };

    document.documentElement.append(host);
  }

  function teardown() {
    releaseLayout();
    if (host) host.remove();
    host = null;
    shadow = null;
    nodes = null;
    lastSerialised = null;
  }

  /* ------------------------------------------------------------------ rendering */

  function render() {
    const parsed = state.parsed;
    if (!parsed) {
      teardown();
      return;
    }

    build();

    const { fields } = nodes;
    fields.textContent = '';

    const entries = ifEnvOrderedFields(parsed.fields);
    const envEntry = entries.find(([key]) => key.toLowerCase() === 'environment');
    const colourEntry = entries.find(([key]) => IF_ENV_COLOUR_KEYS.has(key.toLowerCase()));

    applyColours(ifEnvPaletteFor(colourEntry ? colourEntry[1] : ''));

    // The environment chip leads even when the page named no environment: a banner that cannot
    // say which environment this is has lost its point, so it says so rather than going quiet.
    if (!envEntry) {
      const unknown = ifEnvFieldNode('environment', 'unknown');
      unknown.classList.add('muted');
      fields.append(unknown);
    }
    for (const [key, value] of entries) {
      if (IF_ENV_COLOUR_KEYS.has(key.toLowerCase())) continue;
      fields.append(ifEnvFieldNode(key, value));
    }

    applySize();
    host.style.setProperty('--if-env-shadow', ifEnvShadowFor(settings.position));
    host.dataset.position = settings.position;

    requestAnimationFrame(applyLayout);
  }

  function applySize() {
    ifEnvApplySize(host, settings.size);
  }

  function applyColours(palette) {
    host.style.setProperty('--if-env-bg', palette.bg);
    host.style.setProperty('--if-env-fg', palette.fg);
  }

  /* ------------------------------------------------------------------ layout */

  function releaseLayout() {
    const root = document.documentElement;
    root.style.removeProperty('padding-top');
    root.style.removeProperty('padding-bottom');
    root.style.removeProperty('scroll-padding-top');
    root.style.removeProperty('scroll-padding-bottom');
  }

  function applyLayout() {
    releaseLayout();
    if (!host || !state.parsed || !settings.pushContent) return;
    const height = nodes.bar.offsetHeight;
    if (!height) return;
    const side = settings.position === 'bottom' ? 'bottom' : 'top';
    const root = document.documentElement;
    root.style.setProperty(`padding-${side}`, `${height}px`, 'important');
    root.style.setProperty(`scroll-padding-${side}`, `${height}px`, 'important');
  }

  /* ------------------------------------------------------------------ state */

  function refresh() {
    if (!settings.enabled) {
      state = { ...state, reason: 'disabled', parsed: null };
      teardown();
      return;
    }
    if (settings.scope === 'allowlist' && !ifEnvHostMatches(location.hostname, settings.patterns)) {
      state = { ...state, reason: 'not-allowlisted', parsed: null };
      teardown();
      return;
    }

    const parsed = readMeta();
    const serialised = JSON.stringify(parsed);
    if (serialised === lastSerialised) return;
    lastSerialised = serialised;

    if (parsed && parsed.error) {
      state.parsed = null;
      state.error = parsed.error;
      state.reason = 'error';
      console.error(
        `[Env Info Banner] <meta name="${IF_ENV_META_NAME}"> ignored: ${parsed.error}.`,
        parsed.raw
      );
      render();
      return;
    }

    state.error = null;
    state.parsed = parsed;
    state.reason = parsed ? 'showing' : 'no-meta-tag';
    render();
  }

  function debounce(fn, wait) {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function watch() {
    observers.forEach((o) => o.disconnect());
    observers = [];
    const onChange = debounce(refresh, 120);

    if (document.head) {
      const headObserver = new MutationObserver(onChange);
      headObserver.observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['content', 'name'],
      });
      observers.push(headObserver);
    }

    // Catches SPAs that replace <head> wholesale, and pages that put the meta tag in <body>.
    const rootObserver = new MutationObserver(onChange);
    rootObserver.observe(document.documentElement, { childList: true });
    observers.push(rootObserver);
  }

  /* ------------------------------------------------------------------ messaging */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'if-env-info:status') {
      sendResponse({
        ok: true,
        reason: state.reason,
        fields: state.parsed && state.parsed.fields ? state.parsed.fields : null,
        extra: state.parsed && state.parsed.extra ? state.parsed.extra : null,
        error: state.error,
      });
      return true;
    }
  });

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'sync' || !changes.settings) return;
    settings = await ifEnvGetSettings();
    lastSerialised = null;
    refresh();
    watch();
  });

  /* ------------------------------------------------------------------ boot */

  (async () => {
    settings = await ifEnvGetSettings();
    refresh();
    watch();
    window.addEventListener('resize', debounce(applyLayout, 150));
  })();

  /* ------------------------------------------------------------------ styles */

  const CSS_TEXT = `
    :host {
      all: initial;
      --if-env-bg: #2d3034;
      --if-env-fg: #ffffff;
      --if-env-shadow: 0 2px 5px rgba(0, 0, 0, .18), 0 6px 18px rgba(0, 0, 0, .12);
      /* Size tokens, overridden per setting. These are the small values. */
      --if-env-h: 30px;
      --if-env-fs: 12px;
      --if-env-mono: 11.5px;
      --if-env-pad: 12px;
      --if-env-gap: 14px;
      --if-env-icon: 14px;
      font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    .bar {
      position: fixed;
      z-index: 2147483647;
      background: var(--if-env-bg);
      color: var(--if-env-fg);
      box-sizing: border-box;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: var(--if-env-gap);
      padding: 0 var(--if-env-pad);
      min-height: var(--if-env-h);
      font-size: var(--if-env-fs);
      line-height: 1;
      box-shadow: var(--if-env-shadow);
      overflow-x: auto;
      scrollbar-width: none;
    }
    .bar::-webkit-scrollbar { display: none; }
    :host([data-position="top"]) .bar { top: 0; }
    :host([data-position="bottom"]) .bar { bottom: 0; }

    .fields { display: flex; align-items: center; gap: var(--if-env-gap); flex: 1 1 auto; min-width: 0; }
    .field { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }

    /* Icons sit a touch back from the value so the glyph marks the value without competing. */
    .icon { width: var(--if-env-icon); height: var(--if-env-icon); flex: none; opacity: .8; }

    /* Keys we have no icon for keep their name in words, so nothing is unlabelled. */
    .k { opacity: .65; }

    .v {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: var(--if-env-mono);
      max-width: 42ch;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Every value reads the same; only the icon marks the environment out. */
    .field.is-environment .icon { opacity: 1; }
    .field.muted { opacity: .75; }

    .sr {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;
})();
