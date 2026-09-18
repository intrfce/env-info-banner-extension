const $ = (id) => document.getElementById(id);
const statusEl = $('status');

function linesToList(text) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

function radio(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function fill(settings) {
  $('enabled').checked = settings.enabled;
  $('patterns').value = (settings.patterns || []).join('\n');
  $('pushContent').checked = settings.pushContent;
  document.querySelector(`input[name="scope"][value="${settings.scope}"]`).checked = true;
  document.querySelector(`input[name="position"][value="${settings.position}"]`).checked = true;
  document.querySelector(`input[name="size"][value="${settings.size}"]`).checked = true;
  sync();
}

function collect() {
  return {
    enabled: $('enabled').checked,
    scope: radio('scope'),
    patterns: linesToList($('patterns').value),
    position: radio('position'),
    pushContent: $('pushContent').checked,
    size: radio('size'),
  };
}

/** The sample the preview draws, in the order the banner would put it. */
const PREVIEW_FIELDS = [
  ['environment', 'staging'],
  ['app', 'Shop'],
  ['worktree', 'feature/checkout'],
];

/** Keep the preview and the conditional fields in step with the form. */
function sync() {
  const settings = collect();
  $('patterns-row').style.display = settings.scope === 'allowlist' ? '' : 'none';

  // The colour comes from the page now, so the preview just shows a representative one.
  const palette = ifEnvPaletteFor('#7d4a00');
  const preview = $('preview');
  preview.style.background = palette.bg;
  preview.style.color = palette.fg;
  preview.style.boxShadow = ifEnvShadowFor(settings.position);
  ifEnvApplySize(preview, settings.size);

  preview.textContent = '';
  for (const [key, value] of PREVIEW_FIELDS) preview.append(ifEnvFieldNode(key, value));
}

function flash(message) {
  statusEl.textContent = message;
  setTimeout(() => { statusEl.textContent = ''; }, 2500);
}

document.addEventListener('input', sync);
document.addEventListener('change', sync);

$('save').addEventListener('click', async () => {
  const settings = collect();
  if (settings.scope === 'allowlist' && !settings.patterns.length) {
    flash('Add at least one host pattern, or switch back to every site.');
    return;
  }
  await ifEnvSaveSettings(settings);
  flash('Saved. Reload any open tabs to see the change.');
});

$('reset').addEventListener('click', async () => {
  await ifEnvSaveSettings({ ...IF_ENV_DEFAULTS });
  fill(IF_ENV_DEFAULTS);
  flash('Defaults restored.');
});

ifEnvGetSettings().then(fill);
