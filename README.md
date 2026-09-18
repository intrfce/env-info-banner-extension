# Chrome Environment Info Banner extension.

A Chrome extension that reads a meta tag from the page and shows a banner saying which
environment and worktree you are looking at.

This was designed for use with Laravel, but can be used with any language/framework where you can add a meta tag to the page being output.

```html
<meta name="if-env-info" content='{"environment":"staging","colour":"#7d4a00","app":"Shop","worktree":"feature/checkout"}'>
```

Pages without the tag are untouched, so it is safe to leave switched on everywhere.

## Installing locally / for development.

1. Open `chrome://extensions`.
2. Turn on developer mode.
3. Choose "Load unpacked" and pick this folder.
4. Open `test-page.html` to check it works.

## Meta tag keys

The `content` attribute in the meta tag should be a JSON object of string or number values. Keys are free-form:

| Key | Treatment |
| --- | --- |
| `environment` | Leads the bar, behind a cloud icon. Printed as sent, like every other value. |
| `colour` | The banner colour, as a hex value. Never printed. `color` works too. |
| `app` | Next, behind an app-window icon. |
| `worktree` | Next, behind a folder icon. |
| `extra` | A nested object. Never drawn on the bar — popup only. See below. |
| anything else | Shown as a label/value pair, in the order the page sent it. |

The `extra` key allows no more than 30 fields under `extra`, with 40 characters per key, 200 per value.

Invalid JSON, or an object with nothing usable in it, shows no banner at all and logs the reason and the raw attribute
to the page console. The popup says the same thing if you have it open.

### Colour

The page supplies one hex value and the extension works out the text colour to go on it:

```html
"colour": "#7d4a00"
```

### Settings

<img width="1564" height="1696" alt="CleanShot 2026-09-18 at 10 19 15@2x" src="https://github.com/user-attachments/assets/b5fb0e3d-6110-45f1-b45f-bfef8679a5b8" />

