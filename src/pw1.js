import { chromium } from "npm:playwright";
import { getDefaultBrowserStyle, makeStyleSheet } from "./css1.js";
import { makeLogical } from "./cssMakeLogical.js";
import { Images } from "./Images.js";

// Launch the browser in visible mode
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

/*
function filterAwayDefaultRedundantProperties(rawStyle, defaultStyle) {
  const res = Object.assign(Object.create(null), rawStyle);
  for (let k in defaultStyle)
    if (res[k] === defaultStyle[k])
      delete res[k];
  return res;
}

function processStyles(all) {
  const cache = {};
  const styles = new Map();
  for (let el of all) {
    const cs = getComputedStyle(el);
    const writingModeKey = (el.dir || cs.direction === "rtl" ? "rtl|" : "") + cs.writingMode;
    const res = Object.create(null);
    for (let { style: { rule } } of getMatchedCSS(el)) {
      const ruleLogical = makeLogical(rule, writingModeKey);
      Object.assign(res, ruleLogical);
    }
    const ds = getDefaultBrowserStyle(el.tagName, el.namespaceURI);
    const res2 = filterAwayDefaultRedundantProperties(res, ds);
    const key = "csss_" + sha256(JSON.stringify(Object.entries(res2).sort()));
    cache[key] ??= { key, style: res2 };
    styles.set(el, cache[key]);
  }
  return styles;
}

function findAllFontFaceKeyFrameRulesUsingDevToolsApi() {
  const res = [];
  for (let sheet of document.styleSheets) {
    try {
      for (let rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule || rule instanceof CSSKeyframesRule)
          res.push({ ctx: { href: sheet.href, index: [...sheet.cssRules].indexOf(rule) }, rule });
      }
    } catch (e) {
      // Ignore CORS errors
    }
  }
  return res;
}

function mutatePageStyles(all) {
  const stylesMap = processStyles(all);
  const faceKeyframes = findAllFontFaceKeyFrameRulesUsingDevToolsApi();

  for (const [el, { key, style }] of stylesMap.entries())
    el.classList.add(key);

  const styles2 = Object.fromEntries([...new Set(Object.values(stylesMap))].map(({ key, style }) => [key, style]));
  const styleEl = makeStyleSheet(styles2, faceKeyframes).appendTo(document.head);
  for (let sheet of [...document.styleSheets]) {
    sheet.disabled = true;
    sheet.ownerNode?.remove();
  }
  document.head.appendChild(styleEl);
  return { stylesMap, faceKeyframes };
}
*/

/*
function makePage(document, foundImages) {
  const all = [document.body, ...document.body.querySelectorAll('*:not(script,style,meta,link,head,title,br)')];
  const { stylesMap, faceKeyframes } = mutatePageStyles(all);
  const { images } = retrieveImagesFromPage(foundImages)
  return {
    html: document.documentElement.outerHTML,
    styles: { stylesMap, faceKeyframes },
    images,
    links: [...document.querySelectorAll('a,area')].map(a => a.href),
  };
}
*/

//state
const images = new Images();
const pages = { "https://tegn.tv": undefined };

function getFalsyKey(obj) {
  for (let key in obj)
    if (!obj[key])
      return key;
}

page.on("response", async (response) => {
  if (response.request().resourceType() === "image") {
    await images.addPlaywrightResponse(response);
  }
});

const client = await page.context().newCDPSession(page);
await client.send('DOM.enable');
await client.send('CSS.enable');

for (let url, i = 2; i-- && (url = getFalsyKey(pages));) {
  console.log("Crawling", url);
  const res = await page.goto(url);
  
  // Extract styles via CDP
  const { styleSheetHeaders } = await client.send('CSS.getStyleSheetHeaders');
  const cssTexts = [];
  for (let header of styleSheetHeaders) {
    const { text } = await client.send('CSS.getStyleSheetText', { styleSheetId: header.styleSheetId });
    cssTexts.push({ url: header.sourceURL, text });
  }

  // await page.pause();
  debugger;
  // pages[url] = makePage(res.document(), images);
  // for (let url of pages[url].links)
  //   if (!(url in pages))
  //     pages[url] = undefined;
}

await images.saveZipToDownloads();

// Clean up after you resume/close the inspector
await browser.close();