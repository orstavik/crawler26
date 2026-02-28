'use strict'
const safeURL = url => { try { return new URL(url.trim(), location.href) } catch { return null } }
const parseSrcset = str => str.split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean)
const CallAndCatch = (fn, value) => { try { return fn() } catch { return value } }
const safeFetch = async (url, method, mode) => {
  try {
    const res = await fetch(url, { method, mode })
    if (!res.ok) throw new Error(`Failed to fetch ${url}`)
    return res
  } catch (e) {
  }
}

function Resource(url, kind, type, description, linkContext) {
  const a = safeURL(url)
  if (!a) return null
  const filename = a.pathname.split('/').pop()
  return {
    pageURL: location.href,
    resourceURL: a.href,
    kind,
    type,
    description,
    linkContext,
    filename,
  }
}

const Image = (u, t, d, c) => Resource(u, 'img', t, d, c)
const File = (u, t, d, c) => Resource(u, 'file', t, d, c)
const Page = (u, t, d, c) => Resource(u, 'page', t, d, c)

const extractJSON = (obj, type, res = []) => {
  if (!obj || typeof obj !== 'object') return res
  if (Array.isArray(obj)) return obj.flatMap(i => extractJSON(i, type, res));
  ['image', 'logo', 'thumbnail', 'thumbnailUrl', 'contentUrl'].forEach(k => {
    const v = obj[k]
    if (v) {
      const values = typeof v === 'string' ? [v] : Array.isArray(v) ? v : v?.url ? [v.url] : []
      for (let i = 0; i < values.length; i++) {
        const u = values[i]
        const r = Image(u, `${type}-${k}`, obj.name || obj.description, null)
        if (r) res.push(r)
      }
    }
  })
  Object.values(obj).forEach(v => v && typeof v === 'object' && extractJSON(v, type, res))
  return res
}

const ResourceMap = {
  IMG: ['img', img => [
    Image(img.src, 'img-src', img.alt, img.closest("a[href]")?.href),
    img.currentSrc !== img.src && Image(img.currentSrc, 'img-currentsrc', img.alt, img.closest("a[href]")?.href),
    ...(img.srcset ? parseSrcset(img.srcset).map(u => Image(u, 'img-srcset', img.alt, img.closest("a[href]")?.href)) : []),
    ...['data-src', 'data-lazy', 'data-lazy-src', 'data-srcset', 'data-original', 'data-img', 'data-image'].flatMap(a => {
      const v = img.getAttribute(a)
      if (!v) return []
      return a === 'data-srcset' ? parseSrcset(v).map(u => Image(u, `img-lazy-${a}`, img.alt, img.closest("a[href]")?.href)) : [Image(v, `img-lazy-${a}`, img.alt, img.closest("a[href]")?.href)]
    })
  ].filter(Boolean)],
  PICTURE: ['picture source', s => (s.srcset ? parseSrcset(s.srcset).map(u => Image(u, 'picture-source', s.closest('picture').querySelector('img')?.alt, s.closest('picture').closest("a[href]")?.href)) : []).filter(Boolean)],

  VIDEO: ['video[poster]', vid => [Image(vid.poster, 'video-poster', vid.title || vid.getAttribute('aria-label'))].filter(Boolean)],
  CSS: ['*', el => {
    const bg = getComputedStyle(el).backgroundImage
    return bg !== 'none' ? (bg.match(/url\(['"]?([^'"()]+)['"]?\)/g) || []).map(m => Image(m.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1'), 'css-bg')).filter(Boolean) : []
  }],
  ICONS: ['link[rel*="icon"], link[rel="apple-touch-icon"]', l => [Image(l.href, 'favicon', document.title)].filter(Boolean)],
  SVG: ['svg image', img => [img.href?.baseVal, img.getAttribute('xlink:href')].filter(Boolean).map(u => Image(u, 'svg-image'))],
  OBJECTS: ['object[data], embed[src]', obj => [File(obj.data || obj.src, 'object-embed')].filter(Boolean)],
  Meta: ['meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]', m => [Image(m.content || m.href, 'meta-image', document.title)].filter(Boolean)],
  'JSON-LD': ['script[type="application/ld+json"]', s => {
    try {
      if (!s?.textContent) return []
      return extractJSON(JSON.parse(s.textContent), 'jsonld')
    } catch {
      return []
    }
  }],
  LINKS: ['a[href]', a => {
    const u = safeURL(a.href)
    if (!u || u.origin !== location.origin || u.protocol.startsWith('javascript')) return []
    const ext = (u.pathname.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase()
    const pageExts = ['html', 'htm', 'php', 'asp', 'aspx', 'jsp']
    if (ext && !pageExts.includes(ext)) {
      return [File(u.href, `link-${ext}`, a.textContent.trim(), a.href)]
    }
    return [Page(u.href, ext ? 'link-page' : 'link-route', a.textContent.trim(), a.href)]
  }],
}


function discoverResources() {
  const unique = {};//new Map()
  for (let [k, [sel, fn]] of Object.entries(ResourceMap)) {
    for (let el of document.querySelectorAll(sel)) {
      try {
        for (let record of fn(el))
          if (record)
            unique[record.resourceURL] = record;
      } catch (err) {
        console.error(`❌ Failed to process ${k}:`, err)
      }
    }
  }
  return Object.values(unique)
}

async function upgrading(url) {
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
  ['w', 'width', 'resize'].forEach(param => u.searchParams.delete(param))
  if (u.href != url && await safeFetch(u.href, 'HEAD', 'cors'))
    return u.href
  return url
}

async function getContentType(url, mode) {
  let res = await safeFetch(url, 'HEAD', mode);
  let isCors = true;
  if (!res) {
    isCors = false;
    res = await safeFetch(url, 'HEAD', 'no-cors');
  }
  if (!res) return { contentType: null, isCors: false };
  const contentType = res.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  return { contentType, isCors };
}

async function runPipeline() {
  try {
    const discovered = discoverResources();
    const upgraded = {};
    await Promise.all(discovered.map(async r => {
      if (!r.resourceURL) return r
      const { contentType, isCors } = await getContentType(r.resourceURL, 'cors')
      const upgradedURL = contentType?.startsWith('image/') ? await upgrading(r.resourceURL) : r.resourceURL
      const html = contentType?.startsWith('text/html') ? await safeFetch(upgradedURL, 'GET', 'cors').then(res => res?.text()) : null
      upgraded[upgradedURL] = { ...r, resourceURL: upgradedURL, contentType, isCors, html };
      upgraded[r.resourceURL] = upgraded[upgradedURL];
      return { ...r, resourceURL: upgradedURL, contentType, isCors, html };
    }))
    return upgraded;
  } catch (e) {
    console.error('❌ Pipeline failed:', e)
    return { discovered: [], upgraded: [] }
  }
}
window.resources = {
  safeURL,
  parseSrcset,
  CallAndCatch,
  safeFetch,
  discoverResources,
  upgrading,
  runPipeline,
}