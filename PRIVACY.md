# Privacy Policy for Env Info Banner

**Last updated: 18 September 2026**

## The short version

Env Info Banner does not collect, transmit, sell or share any data. It makes no network requests
of any kind. Everything it does happens inside your browser, and the only thing it stores is your
own settings.

If you would rather read the code than take this on trust, the extension is under 900 lines of
plain JavaScript with no build step and no third-party dependencies. There is nowhere for data to go: the
source contains no `fetch`, no `XMLHttpRequest`, no `sendBeacon`, no WebSocket, no analytics
library and no remotely loaded code.

## What the extension does

Env Info Banner looks on each page for a single HTML meta tag:

```html
<meta name="if-env-info" content='{"environment":"staging","app":"Shop"}'>
```

When it finds one, it draws a coloured bar showing what that tag says, so you can tell at a glance
which environment and project you are looking at. Pages without the tag are left completely
untouched.

That is the extension's only purpose.

## What is stored

One thing: your settings. That is whether the banner is switched on, whether it runs on every site
or only on hosts matching your patterns, the list of those patterns, the banner's position and
size, and whether it pushes the page down.

These are held using Chrome's `storage.sync` API. In practice that means:

- If Chrome Sync is **off**, your settings stay on your computer.
- If Chrome Sync is **on**, Chrome copies them between your own signed-in Chrome installations,
  which means they pass through Google's sync infrastructure. That is Chrome's own mechanism
  operating on your own account — the extension has no server and never sees the data — but it is
  worth knowing that a hostname you add to your pattern list can leave the device this way.

Nothing else is stored. There are no cookies, no tracking identifiers, no local database, and no
record of which pages you have visited or which banners you have been shown.

## What is not collected

To be explicit, using the categories the Chrome Web Store asks developers to declare:

| Category | Collected? |
| --- | --- |
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

## Why it asks to "read and change all your data on all websites"

This is the permission Chrome shows for the extension's host access, and it sounds far broader
than what actually happens. The honest explanation:

The extension cannot know in advance which sites carry the meta tag, so it has to be able to look
on any site you visit. What it does on each page is narrow and fixed:

- It reads one meta tag, `<meta name="if-env-info">`, and nothing else on the page.
- If that tag is absent, the extension does nothing at all and adds nothing to the page.
- If it is present, the extension adds its banner. It writes no other changes to the page.
- It runs only in the top frame. Embedded iframes are never touched.
- It can also run on local files opened in the browser (`file://`), but only if you separately
  tick "Allow access to file URLs" for this extension in `chrome://extensions`. Chrome keeps that
  switched off unless you turn it on.
- The page's content is never copied, stored or sent anywhere. It is read, drawn, and forgotten
  when you navigate away.

The extension does not read form fields, passwords, page text, cookies, or anything else on the
sites you visit.

## The toolbar popup

When you open the popup, it asks the current tab which meta tag it found, so it can show you the
values and explain what the extension is doing there. It also reads the current tab's address to
work out the hostname, so it can offer to add that hostname to your pattern list.

That address is used only to draw the popup and is discarded when the popup closes. A hostname is
written to your settings only if you explicitly click the button to add it.

## Diagnostic messages

If a page sends a malformed tag, the extension writes an explanation to that page's developer
console so whoever maintains the site can fix it. This is a local browser console message. It is
not sent anywhere and is not recorded.

## Third parties

There are none. The extension contacts no servers, includes no third-party code or fonts, and has
no analytics, crash reporting or telemetry.

## Your control over the data

- **Change or clear your settings** at any time from the extension's options page. "Restore
  defaults" resets them.
- **Remove everything** by uninstalling the extension. Chrome deletes its stored settings with it.
  If Chrome Sync is on, removing the extension clears the synced copy too.

## Changes to this policy

If the extension's behaviour ever changes in a way that affects this policy, this document will be
updated and the date at the top changed. Since the policy lives in the extension's source
repository, its full history is visible alongside the code.

## Contact

Questions about this policy or about the extension's handling of data:

<!-- TODO: add a contact email address before submitting to the Chrome Web Store. -->
dan@danmatthews.me
