# crawler26
into the devtools paradise!

## Usage

To generate a single file that can be easily copy-pasted into the dev tools, run:

```bash
npx esbuild src/crawl.js --bundle --outfile=dist/crawler.js
```

Then you can copy the contents of `dist/crawler.js` and paste it into the dev tools console.

Once loaded, you can run the crawler manually:

```javascript
// Run the crawler and store the resulting data
const data = await window.crawl();

// After inspecting the data, download it as a zip file
await window.downloadAsZip(data);
```
