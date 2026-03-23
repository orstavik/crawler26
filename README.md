# crawler26
slow crawl in the devtools paradise!

## how to use
Copy the contents of `dist/crawler.js` and paste it into the dev tools console.

```javascript
const data = await window.crawl();
// inspecting the data manually if you wish
await window.downloadAsZip(data);
```

## Build instructions

```bash
npx esbuild src/crawl.js \
  --bundle \
  --target=esnext \
  --format=iife \
  --supported:dynamic-import=true \
  --external:http://* \
  --external:https://* \
  --outfile=dist/crawler.js
```

## Running with Playwright

First time, we need to install playwright chromium:
```bash
deno run -A npm:playwright install chromium
```

To run the test:
1. Open a separate chrome window. This can be handy.
2. paste and run the script below.
3. copy the ws://... url and paste it in a chrome tab.
4. use the debugger to inspect the code.

* to see the playwright mini devtools inspector, add `await page.pause();` in the `.js` file.

```bash
google-chrome --user-data-dir=/tmp/deno-debug --no-first-run > /dev/null 2>&1 & \
deno run -A --allow-write --allow-env --inspect-wait src/pw1.js 2>&1 | \
sed -u 's|ws://\(.*\)|copy and paste this in chrome:\n\ndevtools://devtools/bundled/inspector.html?v8only=true\&ws=\1\n\n|'
```