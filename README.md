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