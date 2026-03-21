const { GetComputedStyleRaw } = await import('https://cdn.jsdelivr.net/gh/orstavik/making-a@26.03.21.08/getComputedStyleRaw.js');

async function sha256(str) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const getDefaultStyleCache = new Map();
const getDefaultBrowserStyle = (() => {
  const cache = Object.create(null);
  return function (tagName, ns = 'http://www.w3.org/1999/xhtml') {
    if (cache[tagName]) return cache[tagName];
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const el = iframe.contentDocument.createElementNS(ns, tagName);
    iframe.contentDocument.body.appendChild(el);
    const cs = getComputedStyle(el);
    cache[tagName] = Object.create(null);
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      cache[tagName][p.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = cs.getPropertyValue(p);
    }
    document.body.removeChild(iframe);
    return cache[tagName];
  };
})();

function makeStyleSheet(styles, otherStyles) {
  const style = document.createElement('style');
  const otherRules = otherStyles.map(({ ctx, rule }) => `/* ${JSON.stringify(ctx)} */\n${rule.cssText}`).join('\n\n');
  const normalRules = Object.entries(styles).map(([k, v]) => {
    const props = Object.entries(v).map(([prop, value]) => `  ${prop.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}: ${value};`).join('\n');
    return `.${k} {\n${props}\n}`;
  }).join('\n\n');
  style.textContent = `${otherRules}\n\n${normalRules}`;
  return style;
}

async function updateGetComputedStyleRawFiltered() {
  const getRaw = await GetComputedStyleRaw();
  return {
    getStyles: function (el) {
      const rawStyle = getRaw(el);
      const defaultStyle = getDefaultBrowserStyle(el.tagName, el.namespaceURI);
      const style = Object.create(null);
      const sortedKeys = Object.keys(rawStyle).sort((a, b) => a.localeCompare(b));
      for (let k of sortedKeys)
        if (rawStyle[k] !== defaultStyle[k])
          style[k] = rawStyle[k];
      if (Object.keys(style).length)
        return style;
    },
    otherRules: getRaw()
  }
}

async function singleClassCss() {
  const { getStyles, otherRules } = await updateGetComputedStyleRawFiltered();
  const res = Object.create(null);
  const all = [document.body, ...document.body.querySelectorAll('*:not(script,style,meta,link,head,title,br)')];
  for (const el of all) {
    const style = getStyles(el);
    if (!style) continue;
    const key = "csss_" + await sha256(JSON.stringify(style));
    el.classList.add(key);
    res[key] ??= style;
  }
  for (let sheet of document.styleSheets) {
    sheet.disabled = true;
    sheet.ownerNode?.remove();
  }
  const styleEl = makeStyleSheet(res, otherRules);
  document.head.appendChild(styleEl);
  return res;
}

async function tst() {
  debugger;
  await singleClassCss();
}
tst();