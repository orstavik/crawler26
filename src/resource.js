'use strict'
const safeURL = url => { try { return new URL(url.trim(), location.href) } catch { return null } }
const parseSrcset = str => str.split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean)
const safeFetch = async (url, method, mode) => {
  try {
    const res = await fetch(url, { method, mode })
    if (!res.ok) throw new Error(`Failed to fetch ${url}`)
    return res
  } catch (e) {
  }
}

function* extractJSON(obj) {
  if (!obj || typeof obj !== 'object')
    return;
  if (Array.isArray(obj))
    for (let i of obj)
      yield* extractJSON(i);
  const { image, logo, thumbnail, thumbnailUrl, contentUrl } = obj;
  for (let v of [image, logo, thumbnail, thumbnailUrl, contentUrl])
    if (typeof v === 'string')
      yield v
    else if (Array.isArray(v))
      yield* v
    else if (v?.url)
      yield v.url
  for (let v of Object.values(obj))
    if (v && typeof v === 'object')
      yield* extractJSON(v)
}

const ResourceMap = {
  IMG1: ['img[data-src]', img => img.getAttribute('data-src')],
  IMG2: ['img[data-lazy]', img => img.getAttribute('data-lazy')],
  IMG3: ['img[data-lazy-src]', img => img.getAttribute('data-lazy-src')],
  IMG5: ['img[data-original]', img => img.getAttribute('data-original')],
  IMG6: ['img[data-img]', img => img.getAttribute('data-img')],
  IMG7: ['img[data-image]', img => img.getAttribute('data-image')],
  IMG: ['img[src]', img => img.src],
  IMG_CURRENTSRC: ['img[currentSrc]', img => img.currentSrc],
  IMG_SRCSET: ['img[srcset]', img => parseSrcset(img.srcset)],
  IMG_LAZY_SRCSET: ['img[data-srcset]', img => parseSrcset(img.getAttribute('data-srcset'))],

  PICTURE: ['picture source', s => parseSrcset(s.srcset)],

  VIDEO: ['video[poster]', vid => vid.poster],
  CSS: ['*', el => [...getComputedStyle(el).backgroundImage.matchAll(/url\(['"]?([^'"()]+)['"]?\)/g)].map(m => m[1])],
  ICONS: ['link[rel*="icon"], link[rel="apple-touch-icon"]', l => l.href],
  SVG: ['svg image[href]', img => img.href?.baseVal],
  SVG_HREF: ['svg image[xlink:href]', img => img.getAttribute('xlink:href')],
  OBJECTS: ['object[data]', obj => obj.data],
  EMBEDS: ['embed[src]', obj => obj.src],
  Meta: ['meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"][href]', m => m.content || m.href],
  LdJson: ['script[type="application/ld+json"]', s => {
    try {
      if (s?.textContent) return extractJSON(JSON.parse(s.textContent), 'jsonld')
    } catch { }
  }],
  LINKS: ['area[href], a[href]', a => a.href],
}

function* findResources(el) {
  for (let [k, [sel, fn]] of Object.entries(ResourceMap)) {
    if (el.matches(sel)) {
      try {
        const res = fn(el);
        if (res instanceof Array)
          yield* res;
        if (res)
          yield res;
      } catch (err) {
        console.error(`❌ Failed to process ${k}:`, err)
      }
    }
  }
}

function upgrading(url) {
  const u = safeURL(url)
  if (u == null) return null
  const patterns = [
    /^(.+)-\d{2,5}x\d{2,5}(\.[a-z]+)$/i,
    /^(.+)-scaled(\.[a-z]+)$/i,
    /^(.+)-(?:thumb|thumbnail|small|medium|large|full)(\.[a-z]+)$/i,
  ]
  for (let regex of patterns) {
    const match = u.pathname.match(regex)
    if (match) u.pathname = match[1] + match[2]
  }
  for(let param of ['w', 'width', 'resize'])
    u.searchParams.delete(param)
  return u.href
}

async function getContent(url) {
  let res = await safeFetch(url, 'GET', 'cors');
  let isCors = true;
  if (!res) {
    isCors = false;
    res = await safeFetch(url, 'GET', 'no-cors');
  }
  if (!res) return res;
  const contentType = res.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  return { contentType, isCors, res };
}

export async function runPipeline(found, root = document) {
  const discovered = {};
  for (let el of root.querySelectorAll('*')) {
    for (let url of findResources(el)) {
      if (!(url in discovered) && !(url in found)) {
        const upgrade = upgrading(url);
        if (upgrade !== url) {
          const upgradeRes = await getContent(upgrade);
          if (upgradeRes) {
            discovered[url] = discovered[upgrade] = upgradeRes;
            continue;
          }
        }
        discovered[url] = await getContent(url);
      }
    }
  }
  return discovered;
}