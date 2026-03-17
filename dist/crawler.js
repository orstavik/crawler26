(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/resource.js
  var safeFetch = async (url, method) => {
    try {
      const res = await fetch(url, { method, mode: "cors" });
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      return res;
    } catch (e) {
    }
  };
  function upgrading(u) {
    u = new URL(u);
    const patterns = [
      /^(.+)-\d{2,5}x\d{2,5}(\.[a-z]+)$/i,
      /^(.+)-scaled(\.[a-z]+)$/i,
      /^(.+)-(?:thumb|thumbnail|small|medium|large|full)(\.[a-z]+)$/i
    ];
    for (let regex of patterns) {
      const match = u.pathname.match(regex);
      if (match) u.pathname = match[1] + match[2];
    }
    for (let param of ["w", "width", "resize"])
      u.searchParams.delete(param);
    return u.href;
  }
  async function getContent(url) {
    let res = await safeFetch(url, "GET");
    if (!res) return res;
    return { headers: Object.fromEntries(res.headers), res };
  }
  async function runPipeline(found) {
    const discovered = {};
    for (let { name } of performance.getEntriesByType("resource")) {
      const url = new URL(name);
      if (url.href in found || url.origin !== location.origin)
        continue;
      const upgrade = upgrading(url);
      if (upgrade !== url.href) {
        const upgradeRes = await getContent(upgrade);
        if (upgradeRes) {
          discovered[url.href] = discovered[upgrade] = upgradeRes;
          continue;
        }
      }
      discovered[url.href] = await getContent(url.href);
    }
    return discovered;
  }

  // src/csss.js
  var import_csss = __require("https://cdn.jsdelivr.net/gh/orstavik/csss@26.01.28.19/src/csss.js");
  var parse = (0, import_csss.memoize)(import_csss.parse, 3333);
  var REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  var isUnsafeRaw = (v) => /^(inherit|unset|initial|revert|revert-layer)$/.test(v);
  function mergeObj(raw, computed) {
    const merged = { ...raw };
    for (const prop in merged)
      if (isUnsafeRaw(merged[prop]))
        merged[prop] = computed[prop];
    return merged;
  }
  function toLen(pxStr) {
    const px = parseFloat(pxStr) || 0;
    if (!px) return "0";
    if (typeof pxStr === "string" && pxStr.includes("%")) return pxStr.trim();
    for (const base of [REM, 16]) {
      const rem = px / base;
      const candidates = [Math.round(rem), Math.round(rem * 4) / 4, Math.round(rem * 2) / 2];
      for (const v of candidates) {
        if (Math.abs(v - rem) < 0.01 && v > 0 && String(v).split(".")[1]?.length <= 2) return v + "rem";
      }
    }
    return (Math.abs(px - Math.round(px)) < 0.05 ? Math.round(px) : px.toFixed(3).replace(/\.?0+$/, "")) + "px";
  }
  function toColor(rgb) {
    if (!rgb || /^(currentcolor|transparent|rgba\(0, 0, 0, 0\))$/.test(rgb))
      return null;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m)
      return null;
    const [r, g, b, a] = m.slice(1, 5).map((v, i) => i < 3 ? +v : v ? parseFloat(v) : 1);
    if (a === 0)
      return null;
    const hex = [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
    if (a < 1) {
      const alphaHex = Math.round(a * 255).toString(16).padStart(2, "0");
      return `#${hex}${alphaHex}`;
    }
    return `#${hex}`;
  }
  var spaceToComma = (val) => {
    if (!val || val === "none") return "";
    const tokens = val.trim().match(/[^\s(]+\([^)]*\)|[^\s]+/g) || [];
    return tokens.map((v) => v.includes("px") ? toLen(v) : v.includes("rgb") ? toColor(v) : v).filter(Boolean).join(",");
  };
  function toSize(w, h, minW, maxW, minH, maxH) {
    const wL = toLen(w), hL = toLen(h);
    const normMin = (v) => v && parseFloat(v) > 0 ? toLen(v) : null;
    const normMax = (v) => v && v !== "none" && parseFloat(v) < 1e6 ? toLen(v) : null;
    const mnW = normMin(minW), mxW = normMax(maxW);
    const mnH = normMin(minH), mxH = normMax(maxH);
    const wArgs = [mnW || "_", wL, mxW || "_"];
    const hArgs = [mnH || "_", hL, mxH || "_"];
    if (mnW || mxW || mnH || mxH) {
      if ((mnW || mxW) && (mnH || mxH))
        return `size(${[...wArgs, ...hArgs]})`;
      if (mnW || mxW) {
        const wPart = `inlineSize(${wArgs})`;
        return hL === "0" || hL === "auto" ? wPart : `${wPart},size(${wL},${hL})`;
      }
      const hPart = `blockSize(${hArgs})`;
      return wL === "0" || wL === "auto" ? hPart : `size(${wL}),${hPart}`;
    }
    if (hL === "0" || hL === "auto")
      return wL === "0" || wL === "auto" ? null : `size(${wL})`;
    return `size(${wL},${hL})`;
  }
  var REVERSE = {
    Grid: ({
      display,
      gridTemplateColumns,
      gridTemplateRows,
      gap
    }) => {
      if (!(display === "grid" || display === "inline-grid")) return;
      let args = [];
      if (gridTemplateColumns && gridTemplateColumns !== "none") args.push(`cols(${spaceToComma(gridTemplateColumns)})`);
      if (gridTemplateRows && gridTemplateRows !== "none") args.push(`rows(${spaceToComma(gridTemplateRows)})`);
      if (gap && gap !== "normal" && parseFloat(gap) > 0) args.push(`gap(${toLen(gap)})`);
      return args.length ? `$Grid(${args.join(",")})` : "$Grid()";
    },
    Flex: ({
      display,
      flexDirection,
      flexWrap,
      gap,
      alignItems,
      justifyContent
    }) => {
      if (!(display === "flex" || display === "inline-flex"))
        return;
      let args = [];
      if (flexDirection && flexDirection !== "row") args.push(flexDirection.replace(/-([a-z])/g, (g) => g[1].toUpperCase()));
      if (flexWrap && flexWrap === "wrap") args.push("wrap");
      if (gap && gap !== "normal" && parseFloat(gap) > 0) args.push(`gap(${toLen(gap)})`);
      if (alignItems && alignItems !== "normal" && alignItems !== "stretch") {
        const mapped = alignItems.replace("flex-", "").replace("space-", "");
        args.push(`items${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`);
      }
      if (justifyContent && justifyContent !== "normal" && justifyContent !== "flex-start") {
        const mapped = justifyContent.replace("flex-", "").replace("space-", "");
        args.push(`content${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`);
      }
      return `$Flex(${args.join(",")})`;
    },
    Display: ({ display }) => {
      const d = display;
      if (d === "inline-block") return "$IBlock()";
      if (d === "none") return "$hide";
      return null;
    },
    flexItem: ({
      flexGrow,
      flexShrink,
      flexBasis,
      alignSelf,
      width,
      height,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight
    }) => {
      let args = [];
      if (flexGrow !== "0") args.push(`grow(${flexGrow})`);
      if (flexShrink !== "1") args.push(`shrink(${flexShrink})`);
      if (flexBasis !== "auto") args.push(`basis(${toLen(flexBasis)})`);
      if (alignSelf !== "auto" && alignSelf !== "stretch") {
        const mapped = alignSelf.replace("flex-", "");
        args.push(`self${mapped.charAt(0).toUpperCase() + mapped.slice(1)}`);
      }
      const s = toSize(width, height, minWidth, maxWidth, minHeight, maxHeight);
      if (s) args.push(s);
      return args.length ? `$flexItem(${args.join(",")})` : null;
    },
    gridItem: ({
      gridColumnStart,
      gridColumnEnd,
      gridRowStart,
      gridRowEnd,
      justifySelf,
      width,
      height,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight
    }) => {
      let args = [];
      if (gridColumnStart !== "auto" || gridColumnEnd !== "auto")
        args.push(`column(${gridColumnStart === "auto" ? "_" : gridColumnStart},${gridColumnEnd === "auto" ? "_" : gridColumnEnd})`);
      if (gridRowStart !== "auto" || gridRowEnd !== "auto")
        args.push(`row(${gridRowStart === "auto" ? "_" : gridRowStart},${gridRowEnd === "auto" ? "_" : gridRowEnd})`);
      if (justifySelf !== "auto" && justifySelf !== "stretch")
        args.push(`self${justifySelf.charAt(0).toUpperCase() + justifySelf.slice(1)}`);
      const s = toSize(width, height, minWidth, maxWidth, minHeight, maxHeight);
      if (s) args.push(s);
      return args.length ? `$gridItem(${args.join(",")})` : null;
    },
    blockItem: ({
      margin,
      width,
      height,
      float,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight
    }) => {
      let args = [];
      const m = margin.split(" ").map(toLen);
      args.push(`margin(${m.join(",")})`);
      const s = toSize(width, height, minWidth, maxWidth, minHeight, maxHeight);
      if (s) args.push(s);
      if (float === "left" || float === "inline-start") args.push("floatStart");
      else if (float === "right" || float === "inline-end") args.push("floatEnd");
      return args.length ? `$blockItem(${args.join(",")})` : null;
    },
    Paragraph: ({
      textAlign,
      lineHeight,
      fontSize,
      whiteSpace
    }) => {
      let args = [];
      if (textAlign !== "start" && textAlign !== "left")
        args.push(textAlign === "center" ? "center" : textAlign);
      if (lineHeight !== "normal") {
        const lh = parseFloat(lineHeight) / parseFloat(fontSize);
        if (!isNaN(lh)) args.push(lh.toFixed(2).replace(/\.?0+$/, ""));
      }
      if (whiteSpace !== "normal")
        args.push(whiteSpace.replace(/-([a-z])/g, (g) => g[1].toUpperCase()));
      return args.length ? `$paragraph(${args.join(",")})` : null;
    },
    Border: ({
      borderWidth,
      borderStyle,
      borderColor,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomRightRadius,
      borderBottomLeftRadius
    }) => {
      const w = borderWidth.split(" ").map(toLen);
      const st = borderStyle.split(" ");
      const c = borderColor.split(" ").map(toColor);
      const r = [borderTopLeftRadius, borderTopRightRadius, borderBottomRightRadius, borderBottomLeftRadius].map(toLen);
      if (w.every((v) => v === "0") && r.every((v) => v === "0")) return null;
      let args = [];
      if (w.some((v) => v !== "0")) args.push(w.every((v) => v === w[0]) ? w[0] : w.join(","));
      if (st.some((v) => v !== "none")) args.push(st.every((v) => v === st[0]) ? st[0] : st.join(","));
      if (c.some((v) => v)) args.push(c.every((v) => v === c[0]) ? c[0] : c.filter(Boolean).join(","));
      if (r.some((v) => v !== "0")) args.push(r.every((v) => v === r[0]) ? `r(${r[0]})` : `r(${r.join(",")})`);
      return args.length ? `$border(${args.join(",")})` : null;
    },
    Block: ({
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      overflowX,
      overflowY
    }) => {
      const p = [paddingTop, paddingRight, paddingBottom, paddingLeft].map(toLen);
      let args = [];
      if (p.some((v) => v !== "0")) {
        if (p.every((v) => v === p[0])) args.push(`padding(${p[0]})`);
        else if (p[0] === p[2] && p[1] === p[3]) args.push(`padding(${p[0]},${p[1]})`);
        else args.push(`padding(${p.join(",")})`);
      }
      if (overflowX !== "visible" || overflowY !== "visible") {
        if (overflowX === overflowY) args.push(`overflow${overflowX[0].toUpperCase() + overflowX.slice(1)}`);
        else args.push(`overflowBlockInline(${overflowY[0].toUpperCase() + overflowY.slice(1)},${overflowX[0].toUpperCase() + overflowX.slice(1)})`);
      }
      return args.length ? `$block(${args.join(",")})` : null;
    },
    Bg: ({ backgroundColor }) => {
      const c = toColor(backgroundColor);
      return c && c !== "#00000000" ? `$bgColor(${c})` : null;
    },
    Color: ({ color }) => {
      const c = toColor(color);
      if (!c || c === "#000000" || c === "#black") return null;
      return `$color(${c})`;
    },
    Font: ({ fontFamily, fontSize, fontWeight, fontStyle }) => {
      let args = [];
      const ff = fontFamily.split(",")[0].trim().replace(/"/g, "").replace(/\s+/g, "+");
      if (ff && !ff.includes("serif")) args.push(ff);
      args.push(toLen(fontSize));
      if (fontWeight !== "400" && fontWeight !== "normal") args.push(fontWeight === "700" ? "bold" : fontWeight);
      if (fontStyle === "italic") args.push("i");
      return args.length ? `$font(${args.join(",")})` : null;
    },
    Position: ({ position, top, left, right, bottom, zIndex }) => {
      if (position === "static") return null;
      let args = [];
      if (top !== "auto" || left !== "auto") {
        args.push("leftTop");
        args.push(toLen(left === "auto" ? "0" : left));
        args.push(toLen(top === "auto" ? "0" : top));
      } else if (right !== "auto" || bottom !== "auto") {
        args.push("rightBottom");
        args.push(toLen(right === "auto" ? "0" : right));
        args.push(toLen(bottom === "auto" ? "0" : bottom));
      }
      let res = `$${position}(${args.join(",")})`;
      if (zIndex !== "auto") res += `$zIndex(${zIndex})`;
      return res;
    },
    TextShadow: ({ textShadow }) => {
      if (!textShadow || textShadow === "none") return null;
      const layers = textShadow.split(/,\s*(?![^(]*\))/).map((s) => spaceToComma(s.trim())).filter(Boolean);
      return layers.length ? layers.map((l) => `$textShadow(${l})`).join("") : null;
    },
    BoxShadow: ({ boxShadow }) => {
      if (!boxShadow || boxShadow === "none") return null;
      return boxShadow.split(/,\s*(?![^(]*\))/).map((s) => {
        const i = /\binset\b/.test(s);
        const a = spaceToComma(s.replace(/\binset\b/, "").trim());
        return a && `$${i ? "boxShadowInset" : "boxShadow"}(${a})`;
      }).filter(Boolean).join("") || null;
    },
    Transform: ({ transform }) => {
      if (!transform || transform === "none") return;
      return spaceToComma(transform) ? `$transform(${spaceToComma(transform)})` : void 0;
    }
  };
  function initCSSS(newShorts) {
    const style = Object.assign(document.createElement("style"), { id: "csss_omg" });
    document.head.appendChild(style);
    style.shorts = /* @__PURE__ */ new Set();
    for (let short of newShorts) {
      try {
        for (let { cssText } of parse(short)) {
          if (style.shorts.has(short))
            continue;
          style.sheet.insertRule(cssText, style.sheet.cssRules.length);
          style.shorts.add(short);
        }
      } catch (err) {
        console.warn(`Parse failed: ${short}`, err);
      }
    }
    return style;
  }
  function waitForStyles(root) {
    return Promise.all(
      [...root.querySelectorAll('link[rel="stylesheet"]')].filter((l) => !l.sheet).map((l) => new Promise((r) => {
        l.onload = r;
        l.onerror = r;
        setTimeout(r, 3e3);
      }))
    );
  }
  async function minifyCSS() {
    await waitForStyles(document.head);
    const all = [document.body, ...document.body.querySelectorAll("*:not(script,style,meta,link,head,title,br)")];
    const shortsAdded = /* @__PURE__ */ new Set();
    const getRaw = GetComputedStyleRaw();
    for (const el of all) {
      const cs = mergeObj(getRaw(el), getComputedStyle(el));
      for (const [name, fn] of Object.values(REVERSE)) {
        const result = fn(cs);
        if (!result) continue;
        shortsAdded.add(result);
        el.classList.add(result);
      }
    }
    return shortsAdded;
  }

  // src/download.js
  async function downloadAsZip(blobs, zipName, manifest) {
    const { default: JSZip } = await import("https://cdn.skypack.dev/@progress/jszip-esm");
    const zip = new JSZip();
    blobs.forEach((b) => zip.folder(b.isPage ? "pages" : "resources").file(b.filename, b.blob));
    if (manifest) zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(zipBlob), download: zipName }).click();
    return { compressedSize: zipBlob.size, originalSize: blobs.reduce((s, b) => s + b.size, 0) };
  }
  async function downloadAll(resources) {
    const entries = Object.entries(resources);
    const results = await Promise.all(entries.map(async ([url, data]) => {
      if (!data) return null;
      try {
        const isPage = data.html || (data.headers?.["content-type"] || data.contentType || "").includes("text/html");
        const blob = data.html ? new Blob([data.html], { type: "text/html" }) : data.res ? await data.res.blob() : null;
        if (!blob) return null;
        const name = new URL(url).pathname.split("/").filter(Boolean).pop() || "index";
        return { filename: isPage ? name.endsWith(".html") ? name : name + ".html" : name, blob, size: blob.size, originalUrl: url, isPage: !!isPage };
      } catch {
        return null;
      }
    }));
    const blobs = results.filter(Boolean), failed = results.length - blobs.length;
    if (!blobs.length) return { total: entries.length, successful: 0, failed };
    const manifest = {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sourcePage: location.href,
      sourceHostname: location.hostname,
      totalResources: blobs.length,
      resources: blobs.map((b, i) => ({ index: i + 1, filename: b.filename, originalUrl: b.originalUrl, isPage: b.isPage, fileSize: b.size }))
    };
    try {
      const { originalSize, compressedSize } = await downloadAsZip(blobs, `resources-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.zip`, manifest);
      return { total: entries.length, successful: blobs.length, failed, totalBytes: originalSize, compressedBytes: compressedSize };
    } catch {
      return { total: entries.length, successful: 0, failed: failed + blobs.length };
    }
  }

  // src/crawl.js
  async function loadPage(otherHtml) {
    const document2 = new DOMParser().parseFromString(otherHtml, "text/html");
    const thisHeadTxts = Object.fromEntries(document.head.children.map((el) => [el.outerHTML, el]));
    const nextHeadTxts = Object.fromEntries(document2.head.children.map((el) => [el.outerHTML, el]));
    for (let txt of /* @__PURE__ */ new Set([...Object.keys(thisHeadTxts), ...Object.keys(nextHeadTxts)])) {
      if (txt in thisHeadTxts && txt in nextHeadTxts)
        continue;
      delete thisHeadTxts[txt];
      delete nextHeadTxts[txt];
    }
    for (let toBeRemoved of Object.values(thisHeadTxts))
      toBeRemoved.remove();
    for (let toBeAdded of Object.values(nextHeadTxts))
      document.head.appendChild(toBeAdded);
    document.body.replaceWith(document2.body);
  }
  async function processPage(discoveredResources) {
    const shortsAdded = await minifyCSS();
    initCSSS(shortsAdded);
    for (let el of document.querySelectorAll('style:not(#csss_omg), link[rel="stylesheet"]'))
      el.remove();
    const html = document.documentElement.outerHTML;
    const extra = await runPipeline(discoveredResources);
    return { html, extra };
  }
  async function main() {
    const discoveredResources = {
      [location.href]: { contentType: "text/html" }
    };
    const { html, extra } = await processPage(discoveredResources);
    Object.assign(discoveredResources, extra);
    discoveredResources[location.href].html = html;
    let max = 1;
    for (let [url, data] of Object.entries(discoveredResources)) {
      if (!max--) break;
      if (!data) continue;
      if (data.res && data.headers?.["content-type"]?.includes("text/html") && new URL(url).origin === location.origin) {
        const htmlRaw = await data.res.text();
        await loadPage(htmlRaw);
        const { html: html2, extra: extra2 } = await processPage(discoveredResources);
        Object.assign(discoveredResources, extra2);
        discoveredResources[url].html = html2;
      }
    }
    console.log("Crawled resources:", discoveredResources);
    return discoveredResources;
  }
  window.crawl = main;
  window.downloadAsZip = downloadAll;
})();
