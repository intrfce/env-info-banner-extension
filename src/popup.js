const stateEl = document.getElementById('state');
const basicEl = document.getElementById('basic');
const basicFieldsEl = document.getElementById('basic-fields');
const extraEl = document.getElementById('extra');
const extraFieldsEl = document.getElementById('extra-fields');
const actionEl = document.getElementById('action');
const toggleEl = document.getElementById('toggle');

let settings = null;
let tab = null;

document.getElementById('settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

toggleEl.addEventListener('click', async () => {
  settings = { ...settings, enabled: !settings.enabled };
  await ifEnvSaveSettings(settings);
  drawToggle();
  draw(await settledStatus());
});

/* ------------------------------------------------------------------ the page */

/** Ask the page what it is doing. null means no content script there to answer. */
async function askStatus() {
  if (!tab || !tab.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'if-env-info:status' });
  } catch (e) {
    return null;
  }
}

/**
 * The content script re-renders off its own storage listener, so straight after a toggle the
 * first answer can still describe the old state. Wait for one that agrees with what we just
 * saved rather than showing the user a line we already know is stale.
 */
async function settledStatus() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const status = await askStatus();
    if (!status) return null;
    if ((status.reason === 'disabled') === !settings.enabled) return status;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return askStatus();
}

/* ------------------------------------------------------------------ drawing */

/** The message line is for the cases that need explaining; showing the fields explains itself. */
function setState(text) {
  stateEl.textContent = text;
  stateEl.hidden = !text;
}

/** Fill one section, and hide it entirely when the page sent nothing for it. */
function fillSection(section, list, entries) {
  list.textContent = '';
  for (const [key, value] of entries) {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = value;
    list.append(dt, dd);
  }
  section.hidden = entries.length === 0;
}

/** Assignment rather than addEventListener: draw() runs again after every toggle. */
function setAction(label, handler) {
  actionEl.textContent = label;
  actionEl.onclick = handler;
  actionEl.hidden = false;
}

function drawToggle() {
  toggleEl.textContent = settings.enabled ? 'Hide banner' : 'Show banner';
  toggleEl.title = settings.enabled
    ? 'Switch the banner off on every site'
    : 'Switch the banner back on';
}

function draw(status) {
  basicEl.hidden = true;
  extraEl.hidden = true;
  actionEl.hidden = true;
  actionEl.onclick = null;

  // Switched off is a setting, not a property of this page, so it answers before anything else.
  if (!settings.enabled) {
    setState('Switched off on every site.');
    return;
  }

  if (!status) {
    setState('This page is out of reach for extensions, so nothing runs here.');
    return;
  }

  const metaTag = `<meta name="${IF_ENV_META_NAME}">`;

  if (status.reason === 'showing') {
    // Same order as the bar, so the popup reads as an expansion of it rather than a second list.
    setState('');
    fillSection(basicEl, basicFieldsEl, ifEnvOrderedFields(status.fields || {}));
    fillSection(extraEl, extraFieldsEl, Object.entries(status.extra || {}));
    return;
  }

  if (status.reason === 'error') {
    setState(`Found ${metaTag}, but the ${status.error.replace(/^meta tag /, '')}. Nothing is shown; see the console for details.`);
    return;
  }

  if (status.reason === 'no-meta-tag') {
    setState(`No ${metaTag} on this page.`);
    return;
  }

  if (status.reason === 'disabled') {
    setState('Switched off on every site.');
    return;
  }

  if (status.reason === 'not-allowlisted') {
    let host = '';
    try {
      host = new URL(tab.url).hostname;
    } catch (e) {
      host = '';
    }
    setState(host
      ? `${host} does not match any of your host patterns.`
      : 'This site does not match any of your host patterns.');
    if (host) {
      setAction(`Add ${host}`, async () => {
        await ifEnvSaveSettings({ ...settings, patterns: [...settings.patterns, host] });
        chrome.tabs.reload(tab.id);
        window.close();
      });
    }
    return;
  }

  setState('Still starting up. Reload the page and try again.');
}

async function main() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  settings = await ifEnvGetSettings();
  drawToggle();
  draw(await askStatus());
}

main();
