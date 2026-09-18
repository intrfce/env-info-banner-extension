# Env Info Banner

A Chrome extension that reads a meta tag from the page and shows a banner saying which
environment and worktree you are looking at.

```html
<meta name="if-env-info" content='{"environment":"staging","colour":"#7d4a00","app":"Shop","worktree":"feature/checkout"}'>
```

Pages without the tag are untouched, so it is safe to leave switched on everywhere.

## Install locally

1. Open `chrome://extensions`.
2. Turn on developer mode.
3. Choose "Load unpacked" and pick this folder.
4. Open `test-page.html` to check it works.

## The contract

The `content` attribute is a JSON object of string or number values. Keys are free-form:

| Key | Treatment |
| --- | --- |
| `environment` | Leads the bar, behind a cloud icon. Printed as sent, like every other value. |
| `colour` | The banner colour, as a hex value. Never printed. `color` works too. |
| `app` | Next, behind an app-window icon. |
| `worktree` | Next, behind a folder icon. |
| `extra` | A nested object. Never drawn on the bar — popup only. See below. |
| anything else | Shown as a label/value pair, in the order the page sent it. |

Those three keys are the ones the extension knows the meaning of, so they are the ones it can
both place deliberately and mark with an icon; everything else keeps its key in words, because
a glyph the extension had to invent would say less than the word `release` does. Icons are
[Lucide](https://lucide.dev), stored as path data and built as SVG nodes — the banner parses no
markup anywhere. The key is still read out by screen readers from a visually hidden label, and
hovering an icon names it.

That order is fixed. Everything the page sends is shown — there is no way to hide a key from the
extension side, so send only what you want on screen.

Limits, because the page is untrusted input: 12 bar fields, 30 under `extra`, 40 characters per
key, 200 per value. Values are written with `textContent`, never as markup. Invalid JSON, or an
object with nothing usable in it, shows no banner at all and logs the reason and the raw attribute
to the page console. The popup says the same thing if you have it open.

### Extra

Anything under `extra` is detail rather than signal: it is left off the bar and shown in the popup
under its own heading.

```html
<meta name="if-env-info" content='{
  "environment": "staging",
  "colour": "#7d4a00",
  "app": "Shop",
  "extra": {"release": "2026.09.14-3", "db": "app_staging", "php": "8.3.12"}
}'>
```

The split is about where you are looking. The bar is read at a glance while you are doing
something else, so it holds the few things that answer "am I on the right site?" — a long
release hash or a queue driver on there is noise. The popup is somewhere you went on purpose,
so it can afford a table.

`extra` is reserved whatever it contains. A page that sends `"extra": "some string"` gets no
detail table and no stray bar field either, rather than a field mysteriously named `extra`.
Nested objects inside it are dropped the same way single values are, so nothing can render as
`[object Object]`. The popup shows these in the order the page sent them.

### Colour

The page supplies one hex value and the extension works out the text colour to go on it:

```html
"colour": "#7d4a00"
```

`#abc` shorthand works, the leading `#` is optional, and `color` is accepted alongside `colour`
so a page written either way works. Anything that is not three or six hex digits — a colour name,
`rgb(...)`, an empty value, or no `colour` key at all — falls back to grey. That check is strict
rather than forgiving because the value ends up in a CSS custom property, so a value like
`#fff; background: url(...)` has to be refused outright rather than sanitised.

The bar is a single flat colour, and that background is the only thing the page chooses. Text is
white or near-black, whichever has more contrast against it — the crossover is a relative luminance
of 0.18, where the two are equal. Deriving it rather than accepting it means a page cannot pick an
unreadable pairing.

Every colour in the old fixed palette clears WCAG AA for text contrast under this rule, and so do
white, black, pure red and bright yellow.

The tag name is not editable. It is fixed at `if-env-info`, so a page and the extension can never
disagree about what to call it.

## Behaviour worth knowing

- The toolbar popup says what the extension is doing on the current page, and has a show/hide
  button. That button flips the same `enabled` setting as the checkbox in settings, so it is off
  everywhere rather than on this tab only — the content script watches its settings, so open tabs
  update without a reload.
- The banner comes in three sizes — small, large and extra large — set in settings. Each one
  scales the bar height, text, icons and padding together from a single set of custom properties,
  so the layout push follows automatically.
- If the page sends no `environment`, the bar still leads with the cloud icon and a dimmed
  `unknown` rather than quietly dropping it. A banner that cannot say which environment you are
  looking at has lost its point, so it says so.
- The bar is separated from the page by a drop shadow rather than a border. A full-width 2px rule
  in the banner colour was louder than the thing it was dividing; a shadow does the same job
  quietly and reads the same way on pale and dark pages. It falls away from the page, so it flips
  direction when the banner is at the bottom.
- The banner pushes the page down by setting `padding-top` on `<html>`. Sites with their own
  `position: fixed` header will still have that header sit under the banner, so there is a
  "float over the page" option for those.
- A `MutationObserver` watches the head, so single-page apps that swap the tag on navigation
  update the banner without a reload.
- Top frame only. Iframes never get their own banner.

## Laravel side

Until the package exists, a layout partial does the job:

```blade
@unless (app()->isProduction())
    <meta name="if-env-info" content="{{ json_encode([
        'environment' => app()->environment(),
        'colour' => match (app()->environment()) {
            'production' => '#96150f',
            'staging', 'uat' => '#7d4a00',
            'testing' => '#4d3382',
            'local' => '#0f3f74',
            default => '#2d3034',
        },
        'app' => config('app.name'),
        'worktree' => basename(base_path()),
        'extra' => [
            'release' => config('app.release'),
            'db' => config('database.connections.'.config('database.default').'.database'),
            'php' => PHP_VERSION,
        ],
    ]) }}">
@endunless
```

Blade's `{{ }}` escapes the quotes into entities, which the browser decodes back to valid JSON,
so no manual quoting is needed.

Things to decide when this becomes a package:

- Where the environment-to-colour map lives. The extension deliberately has no opinion, so the
  package owns it — a config array is the obvious home, so an app can recolour its `uat` without
  touching code. Shipping a sensible default map is most of the package's value here.

- Middleware injecting into the response, or a Blade component the layout includes. Middleware
  catches every response including ones you forgot about; a component keeps it opt-in and avoids
  touching streamed or non-HTML responses.
- Whether to ship on production at all. Showing a red banner on production is useful for catching
  "am I on the live site?" mistakes, but it leaks the environment name to anyone who views source.
  Default to off there, with a config flag and a gate for admins.
- The worktree value. `basename(base_path())` is free but only right if directories are named after
  branches. Reading `git rev-parse --abbrev-ref HEAD` is accurate but shells out on every request,
  so cache it or bake it in at deploy time.

## Publishing to the Web Store

- The listing has to justify "read and change all your data on all websites". The honest version:
  it checks every page for one meta tag and does nothing else. Point at the source.
- No remote code, no analytics, no network calls at all. Keep it that way; it is the reason the
  review stays simple.
- You need a privacy policy URL even though nothing is collected. One paragraph is fine.
- Screenshots: the banner on a staging page and the settings screen.
- `version` in `manifest.json` has to increase on every upload.
