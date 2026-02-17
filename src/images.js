window.wow = async function wow() {
  'use strict'
  const safeURL = url => { try { return new URL(url.trim(), location.href) } catch { return null } }
  const abs = url => safeURL(url)?.href
  const matchAny = (str, patterns) => patterns.some(p => (p instanceof RegExp ? p.test(str) : str.includes(p)))
  const queryMap = (sel, fn, root = document) => Array.from(root.querySelectorAll(sel)).flatMap(fn).filter(Boolean)
  const parseSrcset = str => str.split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean)
  const getParams = url => { const u = safeURL(url); return u ? { w: u.searchParams.get('w') || u.searchParams.get('width'), h: u.searchParams.get('h') || u.searchParams.get('height') } : {} }

  const CallAndCatch = (fn, value) => { try { return fn() } catch { return value } }

  const discoverImages = () => {

    const SelectorMap = {
      IMG: () => queryMap('img', img => [
        rec(img.src, 'img-src', img.alt, findLink(img)),
        img.currentSrc !== img.src && rec(img.currentSrc, 'img-currentsrc', img.alt, findLink(img)),
        ...(img.srcset ? parseSrcset(img.srcset).map(u => rec(u, 'img-srcset', img.alt, findLink(img))) : []),
        ...['data-src', 'data-lazy', 'data-lazy-src', 'data-srcset', 'data-original', 'data-img', 'data-image'].flatMap(a => {
          const v = img.getAttribute(a)
          if (!v) return []
          return a === 'data-srcset' ? parseSrcset(v).map(u => rec(u, `img-lazy-${a}`, img.alt, findLink(img))) : [rec(v, `img-lazy-${a}`, img.alt, findLink(img))]
        })
      ]),
      PICTURE: () => queryMap('picture source', s => s.srcset ? parseSrcset(s.srcset).map(u => rec(u, 'picture-source', s.closest('picture').querySelector('img')?.alt, findLink(pic))) : []),

      VIDEO: () => queryMap('video[poster]', vid => rec(vid.poster, 'video-poster', vid.title || vid.getAttribute('aria-label'))),
      CSS: () => queryMap('*', el => {
        const bg = getComputedStyle(el).backgroundImage
        return bg !== 'none' ? (bg.match(/url\(['"]?([^'"()]+)['"]?\)/g) || []).map(m => rec(m.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1'), 'css-bg')) : []
      }),
      ICONS: () => queryMap('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="shortcut icon"]', l => rec(l.href, 'favicon', document.title)),
      SVG: () => queryMap('svg image', img => [img.href?.baseVal, img.getAttribute('xlink:href')].filter(Boolean).map(u => rec(u, 'svg-image'))),
      OBJECTS: () => queryMap('object[data], embed[src]', obj => rec(obj.data || obj.src, 'object-embed')),
      Meta: () => queryMap('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]', m => rec(m.content || m.href, 'meta', document.title)),
      'JSON-LD': () => queryMap('script[type="application/ld+json"]', CallAndCatch(s => extractJSON(JSON.parse(s.textContent), 'jsonld'), []))
    }

    const rec = (url, type, desc = null, link = null) => {
      const a = abs(url)
      if (!a) return null
      const segs = new URL(a).pathname.split('/').filter(Boolean)
      return { pageURL: location.href, imageURL: a, type, description: desc, linkContext: link, filename: segs[segs.length - 1] || null }
    }
    const findLink = el => { while (el && el !== document.body) { if (el.tagName === 'A' && el.href) return el.href; el = el.parentElement } return null }
    const extractJSON = (obj, type, res = []) => {
      if (!obj || typeof obj !== 'object') return res
      if (Array.isArray(obj)) return obj.flatMap(i => extractJSON(i, type, res));
      ['image', 'logo', 'thumbnail', 'thumbnailUrl', 'contentUrl'].forEach(k => {
        const v = obj[k]
        if (v) {
          const values = typeof v === 'string' ? [v] : Array.isArray(v) ? v : v?.url ? [v.url] : []
          for (let i = 0; i < values.length; i++) {
            const u = values[i]
            const r = rec(u, `${type}-${k}`, obj.name || obj.description)
            if (r) res.push(r)
          }
        }
      })
      Object.values(obj).forEach(v => v && typeof v === 'object' && extractJSON(v, type, res))
      return res
    }
    const unique = [...new Map(Object.values(SelectorMap).flatMap(fn => CallAndCatch(fn, [])).map(r => [r.imageURL, r])).values()]

    return unique
  }

  const upgradeToOriginals = async (discovered) => {
    const tryOriginal = (url) => {
      const u = safeURL(url)
      if (!u) return []
      const patterns = [
        { regex: /^(.+)-\d{2,5}x\d{2,5}(\.[a-z]+)$/i, replace: (m) => m[1] + m[2] },
        { regex: /^(.+)-scaled(\.[a-z]+)$/i, replace: (m) => m[1] + m[2] },
        { regex: /^(.+)-(thumb|thumbnail|small|medium|large|full)(\.[a-z]+)$/i, replace: (m) => m[1] + m[3] },
      ]
      const candidates = new Set(
        patterns.flatMap(({ regex, replace }) => {
          const match = u.pathname.match(regex)
          return match ? u.origin + replace(match) : []
        })
      )
      if (u.search && ['w', 'width', 'resize'].some(param => u.searchParams.has(param))) {
        candidates.add(u.origin + u.pathname)
      }
      return Array.from(candidates)
    }
    const verifyURL = async (url) => {
      try {
        const res = await fetch(url, { method: 'HEAD', mode: 'cors' })
        return res.ok
      } catch {
        return false
      }
    }
    return Promise.all(
      discovered.map(async (img) => {
        const orig = (await Promise.all(tryOriginal(img.imageURL).map(async (url) => (await verifyURL(url)) ? url : null))).find(Boolean)
        return orig ? { ...img, imageURL: orig, type: 'upgraded-original', filename: new URL(orig).pathname.split('/').pop() } : img
      })
    )
  }

  const analyzeImages = images => {
    const cdnPatterns = [
      { rx: /cloudinary\.com/, t: 'cloudinary', tx: /\/(c_|w_|h_)/ },
      { rx: /imgix\.net/, t: 'imgix', tx: /[?&](w=|h=)/ },
      { rx: /(akamai|cloudfront)/, t: 'akamai', tx: /[?&](w|h)=/ },
    ]
    const parseCDN = (url) => {
      const cdn = cdnPatterns.find((p) => p.rx.test(url))
      const hasParams = Object.values(getParams(url)).some(Boolean)
      return {
        isCDN: !!cdn,
        cdnType: cdn?.t || null,
        hasTransformations: hasParams || cdn?.tx.test(url),
      }
    }
    const parseDims = (url) => {
      const params = getParams(url)
      if (params.w && params.h) {
        return { width: +params.w, height: +params.h, area: +params.w * +params.h }
      }
      const match = url.match(/[_-](\d{2,5})[x×](\d{2,5})/i)
      return match ? { width: +match[1], height: +match[2], area: +match[1] * +match[2] } : null
    }
    const analyzeUI = (url, desc = '', type = '') => {
      const dims = parseDims(url)
      const ratio = dims?.width / dims?.height
      const isSmall = dims?.area < 10000
      const isExtremeRatio = ratio > 6 || ratio < 0.15

      if (type.startsWith('favicon') || type === 'css-bg' || /\.(svg|ico)$/i.test(url)) return { isUI: true, conf: 0.9 }
      if (matchAny(url, [/\/(icons?|logos?|favicon|ui|nav|menu)\//i]) || matchAny((url + desc).toLowerCase(), ['logo', 'icon', 'favicon', 'badge', 'avatar'])) return { isUI: true, conf: 0.8 }
      if (dims && (isExtremeRatio || isSmall)) return { isUI: true, conf: 0.7 }

      return { isUI: false, conf: 0 }
    }
    const repeat = images.reduce((acc, img) => {
      acc[img.imageURL] = (acc[img.imageURL] || 0) + 1
      return acc
    }, {})

    return images.map((img) => ({
      ...img,
      ui: analyzeUI(img.imageURL, img.description, img.type),
      rep: { isRepeated: repeat[img.imageURL] > 3, count: repeat[img.imageURL] },
      cdn: parseCDN(img.imageURL),
      dims: parseDims(img.imageURL),
    }))
  }

  const filterImages = analyzed => {
    const content = analyzed.filter(img => !(img.ui.isUI || img.rep.isRepeated))
    const filtered = analyzed.filter(img => img.ui.isUI || img.rep.isRepeated)
    return { content, filtered }
  }

  const scoreAndGroupImages = content => {
    const typeScores = { 'img-src': 50, 'img-currentsrc': 45, 'meta-og:image': 70, 'meta-twitter:image': 65, 'jsonld-image': 60, 'css-bg': 10, 'upgraded-original': 100 }
    const calcScore = (img, dims, cdn) => {
      let s = 100
      s += typeScores[img.type] || 0
      if (dims) { s += Math.min(dims.area / 10000, 100); if (dims.width / dims.height >= 0.6 && dims.width / dims.height <= 2.5) s += 15 } else s -= 20
      if (cdn.isCDN) s += cdn.hasTransformations ? -25 : 10
      if (img.linkContext) s += 20
      if (img.description?.length > 5) s += 15
      if (img.imageURL.endsWith('.webp')) s += 15
      if (/[_-](original|raw|hd|large)/.test(img.imageURL)) s += 30
      if (/[_-](thumb|small|preview)/.test(img.imageURL)) s -= 40
      return Math.max(0, s)
    }
    const normalize = url => {
      const u = safeURL(url)
      if (!u) return url
      const path = u.pathname.replace(/\/upload\/[^/]+\//, '/upload/').replace(/[_-](\d{2,5}[x×]\d{2,5})/gi, '').replace(/[_-](thumb|small|medium|large|xl)/gi, '')
      const segs = path.split('/').filter(Boolean)
      return `${u.hostname}::${path}::${segs[segs.length - 1]}`
    }
    const enriched = content.map(img => ({ ...img, score: calcScore(img, img.dims, img.cdn) }))
    const groupBy = (arr, keyFn) => {
      const groups = new Map()
      arr.forEach(item => {
        const key = keyFn(item)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(item)
      })
      return Array.from(groups.values())
    }
    const groups = groupBy(enriched, img => normalize(img.imageURL))
    return groups
  }

  const refineResults = groups => {
    const refined = groups.map((vars, idx) => {
      const sorted = [...vars].sort((a, b) => b.score - a.score)
      const best = sorted[0]
      let conf = best.score / 200
      if (vars.length > 1) conf *= 1.2
      if (best.type.startsWith('meta-') || best.type.startsWith('jsonld-')) conf *= 1.15
      if (best.linkContext && best.description) conf *= 1.1
      conf = Math.min(conf, 1)
      return {
        rank: idx + 1,
        selected: { imageURL: best.imageURL, filename: best.filename, type: best.type, description: best.description, dims: best.dims, score: Math.round(best.score), isCDN: best.cdn.isCDN },
        alternatives: sorted.slice(1, 4).map(a => ({ imageURL: a.imageURL, dims: a.dims, score: Math.round(a.score) })),
        confidence: Math.round(conf * 100) / 100,
        variantCount: vars.length
      }
    })
    const final = refined.sort((a, b) => (b.confidence * b.selected.score) - (a.confidence * a.selected.score)).map((item, idx) => ({ ...item, rank: idx + 1 }))
    return final
  }

  const ensureJSZip = async () => {
    if (window.JSZip) return true
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
      s.integrity = 'sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg=='
      s.crossOrigin = 'anonymous'
      s.onload = () => resolve(true)
      s.onerror = () => reject(new Error('JSZip failed'))
      document.head.appendChild(s)
    })
  }

  const simpleHash = str => Array.from(str).reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0) & h, 0) >>> 0
  const extractDomain = () => location.hostname.toLowerCase().replace(/\./g, '-')
  const extractPostSlug = () => {
    const segs = location.pathname.split('/').filter(Boolean)
    const last = segs[segs.length - 1] || 'index'
    return (last.replace(/\.(html?|php|aspx?)$/i, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 60)) || 'page'
  }
  const extractExt = url => {
    try {
      const ext = new URL(url).pathname.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return ext
    } catch { }
    return 'jpg'
  }
  const normalizeFilename = (url, rank, total) => `${extractDomain()}_${extractPostSlug()}_${String(rank).padStart(total > 99 ? 3 : 2, '0')}_${simpleHash(url).toString(36).padEnd(8, '0')}.${extractExt(url)}`

  const downloadAsZip = async (blobs, zipName = 'images.zip', manifest = null) => {
    await ensureJSZip()
    const zip = new JSZip()
    blobs.forEach(img => zip.file(img.filename, img.blob))
    if (manifest) zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
    const url = URL.createObjectURL(zipBlob)
    const a = Object.assign(document.createElement('a'), { href: url, download: zipName, style: 'display:none' })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
    return { success: true, compressedSize: zipBlob.size, originalSize: blobs.reduce((s, i) => s + i.size, 0) }
  }

  const downloadAllImages = async (candidates) => {
    const blobs = [], failed = { count: 0 }
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i], url = c.selected?.imageURL || c.imageURL
      if (!url) { failed.count++; continue }
      try {
        const res = await fetch(url, { mode: 'cors', headers: { 'Accept': 'image/*,*/*;q=0.8' } })
        if (!res.ok) throw 0
        const blob = await res.blob()
        blobs.push({ filename: normalizeFilename(url, c.rank || i + 1, candidates.length), blob, size: blob.size, originalUrl: url })
      } catch { failed.count++ }
    }
    if (!blobs.length) return { total: candidates.length, successful: 0, failed: failed.count }
    const timestamp = new Date().toISOString()
    const manifest = {
      generatedAt: timestamp,
      sourcePage: location.href,
      sourceHostname: location.hostname,
      sourcePathname: location.pathname,
      totalImages: blobs.length,
      images: blobs.map((blob, idx) => {
        const c = candidates.find(c => (c.selected?.imageURL || c.imageURL) === blob.originalUrl) || candidates[idx]
        return {
          rank: c?.rank || idx + 1,
          filename: blob.filename,
          originalUrl: blob.originalUrl,
          confidence: c?.confidence,
          score: c?.selected?.score,
          dimensions: c?.selected?.dims,
          type: c?.selected?.type,
          description: c?.selected?.description,
          isCDN: c?.selected?.isCDN,
          variantCount: c?.variantCount,
          fileSize: blob.size
        }
      })
    }
    const zipName = `images-${timestamp.split('T')[0]}.zip`
    try {
      const zipResult = await downloadAsZip(blobs, zipName, manifest)
      return { total: candidates.length, successful: blobs.length, failed: failed.count, totalBytes: zipResult.originalSize, compressedBytes: zipResult.compressedSize }
    } catch {
      return { total: candidates.length, successful: 0, failed: failed.count + blobs.length }
    }
  }

  try {
    const discovered = discoverImages()
    if (!discovered.length) { console.warn('⚠️  No images found'); return }
    const upgraded = await upgradeToOriginals(discovered)
    const analyzed = analyzeImages(upgraded)
    const { content, filtered } = filterImages(analyzed)
    const groups = scoreAndGroupImages(content)
    const refined = refineResults(groups)
    const results = { discovered, refined, filtered }
    window.$imagePipelineResults = results
    window.$imageRefinementResults = refined
    debugger
    return
    window.$downloadAsZip = () => downloadAllImages(refined);
    (async () => {
      try {
        await downloadAllImages(refined)
      } catch (e) {
        console.error('Auto-download failed:', e)
      }
    })()
    return results
  } catch (e) {
    console.error('❌ Pipeline failed:', e)
    return { discovered: [], refined: [], filtered: [] }
  }
}
window.wow();