window.wow2 = async function wow () {
  'use strict'
  const safeURL = url => { try { return new URL(url.trim(), location.href) } catch { return null } }
  const parseSrcset = str => str.split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean)
  const CallAndCatch = (fn, value) => { try { return fn() } catch { return value } }
  const verifyURL = async (url) => { try { return (await fetch(url, { method: 'HEAD', mode: 'cors' })).ok } catch { return false } }
  const simpleHash = str => Array.from(str).reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0) & h, 0) >>> 0
  const extractDomain = () => location.hostname.toLowerCase().replace(/\./g, '-')
  const extractPostSlug = () => (location.pathname.split('/').filter(Boolean).pop() || 'page').toLowerCase().replace(/\.(?:html?|php|aspx?)$/i, '').replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page'

  const extractExt = url => {
    try {
      const ext = new URL(url).pathname.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return ext
    } catch {}
    return 'jpg'
  }
  const normalizeFilename = (url, rank, total) => `${extractDomain()}_${extractPostSlug()}_${String(rank).padStart(total > 99 ? 3 : 2, '0')}_${simpleHash(url).toString(36).padEnd(8, '0')}.${extractExt(url)}`

  const discoverImages = () => {

    function Image (url, type, description, linkContext) {
      const a = safeURL(url)
      if (!a) return null
      const filename = a.pathname.split('/').pop()
      return {
        pageURL: location.href,
        imageURL: a.href,
        type,
        description,
        linkContext,
        filename,
      }
    }

    const ImageMap = {
      IMG: ['img', img => [
        Image(img.src, 'img-src', img.alt, findLink(img)),
        img.currentSrc !== img.src && Image(img.currentSrc, 'img-currentsrc', img.alt, findLink(img)),
        ...(img.srcset ? parseSrcset(img.srcset).map(u => Image(u, 'img-srcset', img.alt, findLink(img))) : []),
        ...['data-src', 'data-lazy', 'data-lazy-src', 'data-srcset', 'data-original', 'data-img', 'data-image'].flatMap(a => {
          const v = img.getAttribute(a)
          if (!v) return []
          return a === 'data-srcset' ? parseSrcset(v).map(u => Image(u, `img-lazy-${a}`, img.alt, findLink(img))) : [Image(v, `img-lazy-${a}`, img.alt, findLink(img))]
        })
      ]],
      PICTURE: ['picture source', s => s.srcset ? parseSrcset(s.srcset).map(u => Image(u, 'picture-source', s.closest('picture').querySelector('img')?.alt, findLink(pic))) : []],

      VIDEO: ['video[poster]', vid => Image(vid.poster, 'video-poster', vid.title || vid.getAttribute('aria-label'))],
      CSS: ['*', el => {
        const bg = getComputedStyle(el).backgroundImage
        return bg !== 'none' ? (bg.match(/url\(['"]?([^'"()]+)['"]?\)/g) || []).map(m => Image(m.replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1'), 'css-bg')) : []
      }],
      ICONS: ['link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="shortcut icon"]', l => Image(l.href, 'favicon', document.title)],
      SVG: ['svg image', img => [img.href?.baseVal, img.getAttribute('xlink:href')].filter(Boolean).map(u => Image(u, 'svg-image'))],
      OBJECTS: ['object[data], embed[src]', obj => Image(obj.data || obj.src, 'object-embed')],
      Meta: ['meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]', m => Image(m.content || m.href, 'meta', document.title)],
      'JSON-LD': ['script[type="application/ld+json"]', CallAndCatch(s => extractJSON(JSON.parse(s.textContent), 'jsonld'), [])]
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
            const r = Image(u, `${type}-${k}`, obj.name || obj.description)
            if (r) res.push(r)
          }
        }
      })
      Object.values(obj).forEach(v => v && typeof v === 'object' && extractJSON(v, type, res))
      return res
    }

    const unique = new Map()
    for (let k in ImageMap) {
      const [sel, fn] = ImageMap[k]
      for (let el of document.querySelectorAll(sel)) {
        try {
          for (let record of fn(el))
            if (record) unique.set(record.imageURL, record)
        } catch (err) {
        }
      }
    }
    return unique.values()
  }

  async function upgrading (url) {
    const u = safeURL(url)
    const patterns = [
      /^(.+)-\d{2,5}x\d{2,5}(\.[a-z]+)$/i,
      /^(.+)-scaled(\.[a-z]+)$/i,
      /^(.+)-(?:thumb|thumbnail|small|medium|large|full)(\.[a-z]+)$/i,
    ]
    for (let regex of patterns) {
      const match = u.pathname.match(regex)
      if (match) u.pathname = match[1] + match[2]
    }
    // for (let param of ['w', 'width', 'resize'])
    //   if (u.searchParams.has(param))
    //     u.searchParams.delete(param)
    ['w', 'width', 'resize'].forEach(param => u.searchParams.delete(param))
    if (u.href != url && await verifyURL(u))
      return u.href
    return url
  }

  function checkIfImageIsCors (url) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    })
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


  const downloadAsZip = async (blobs, zipName = 'images.zip', manifest = null) => {
    await ensureJSZip()
    const zip = new JSZip()
    blobs.forEach(img => zip.file(img.filename, img.blob))
    if (manifest) zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
    const url = URL.createObjectURL(zipBlob)
    const a = Object.assign(document.createElement('a'), { href: url, download: zipName, style: 'display:none' })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 300)
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
        if (!res.headers.get('Content-Type')?.startsWith('image/')) throw 0
        const blob = await res.blob()
        blobs.push({ filename: normalizeFilename(url, c.rank || i + 1, candidates.length), blob, size: blob.size, originalUrl: url, candidates: c })
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
        const c = blob.candidates
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

  async function main () {
    try {
      const discovered = discoverImages()
      //   const upgradeds = [];
      //   for (let img of discovered) {
      //     const upgraded = { ...img };
      //     upgraded.imageURL = await upgrading(upgraded.imageURL);
      //     upgraded.isCors = await checkIfImageIsCors(upgraded.imageURL);
      //     upgradeds.push(upgraded);
      //   }
      const upgradeds = await Promise.all(discovered.map(async img => {
        try {
          const upgradedURL = await upgrading(img.imageURL)
          return { ...img, imageURL: upgradedURL, isCors: await checkIfImageIsCors(upgradedURL) }
        } catch { return { ...img, isCors: false } }
      }))
      window.$imagePipelineResults = { discovered, upgraded: upgradeds }
      window.$downloadAsZip = () => downloadAllImages(upgradeds)
      return { discovered, upgraded: upgradeds }
    } catch (e) {
      console.error('❌ Pipeline failed:', e)
      return { discovered: [], upgraded: [] }
    }
  }
  main()
}
window.wow2()
