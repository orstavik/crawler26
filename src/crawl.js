(async function crawlController () {
  'use strict'
  let resources;
  resources = window.resources

  function mergeHead (doc) {
    const head = document.head
    const appendAll = selector =>
      doc.head.querySelectorAll(selector)
        .forEach(el => head.appendChild(el.cloneNode(true)))
    appendAll('link[rel="stylesheet"], link[rel*="icon"]')
    appendAll('style')
  }

  async function processNextPage (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    mergeHead(doc)
    await waitForStyles(document.head)
    document.body.replaceWith(doc.body)
    window.minifyCSS()
    await window.initCSSS()
    return await resources.runPipeline()
  };

  const waitForStyles = (root) => Promise.all([...root.querySelectorAll('link[rel="stylesheet"]')].map(l =>
    l.sheet || new Promise(r => { l.onload = r; l.onerror = r; setTimeout(r, 3000) })
  ))

  const downloadAsZip = async (blobs, zipName = 'resources.zip', manifest = null) => {
    const { default: JSZip } = await import('https://cdn.skypack.dev/@progress/jszip-esm');
    const zip = new JSZip();
    for (const item of blobs) {
      const contentType = item.candidates?.contentType ?? (await getContentType(item.originalUrl, 'cors'))?.contentType
      const folder = contentType?.startsWith('text/html') ? 'pages' : 'resources'
      const candidateFilename =
        item.candidates?.filename && item.candidates.filename !== ''
          ? item.candidates.filename
          : null
      zip.folder(folder).file(candidateFilename || item.filename, item.blob)
    }
    if (manifest) zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
    const url = URL.createObjectURL(zipBlob)
    const a = Object.assign(document.createElement('a'), { href: url, download: zipName, style: 'display:none' })
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 300)
    return { success: true, compressedSize: zipBlob.size, originalSize: blobs.reduce((s, i) => s + i.size, 0) }
  }
  const downloadAll = async (candidates) => {
    const blobs = [], failed = { count: 0 }
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i], url = c.selected?.resourceURL || c.resourceURL
      if (!url) { failed.count++; continue };
      try {
        const res = await safeFetch(url, 'GET', 'cors')
        if (!res) throw 0
        const blob = await res.blob()
        blobs.push({ filename: btoa(url), blob, size: blob.size, originalUrl: url, candidates: c })
      } catch (e) { failed.count++ }
    }
    if (!blobs.length) return { total: candidates.length, successful: 0, failed: failed.count }
    const timestamp = new Date().toISOString()
    const manifest = {
      generatedAt: timestamp,
      sourcePage: location.href,
      sourceHostname: location.hostname,
      sourcePathname: location.pathname,
      totalResources: blobs.length,
      resources: blobs.map((blob, idx) => {
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
    const zipName = `resources-${timestamp.split('T')[0]}.zip`
    try {
      const zipResult = await downloadAsZip(blobs, zipName, manifest)
      return { total: candidates.length, successful: blobs.length, failed: failed.count, totalBytes: zipResult.originalSize, compressedBytes: zipResult.compressedSize }
    } catch {
      return { total: candidates.length, successful: 0, failed: failed.count + blobs.length }
    }
  }

  async function main () {
    const visited = new Set()
    window.minifyCSS()        
    await window.initCSSS()   
    
    const upgraded = await resources.runPipeline()
    upgraded[location.href] = { resourceURL: location.href, contentType: 'text/html', isCors: true, html: document.documentElement.outerHTML, ...upgraded[location.href] }
    visited.add(location.href)
    for (const resource of Object.values(upgraded)) {
      const { resourceURL, html } = resource
      if (html) {
        const extra = await processNextPage(html)
        visited.add(resourceURL)
        Object.assign(extra, upgraded)
        if (visited.size >= 2) {
          break
        }
      }
    }
    window.$downloadAsZip = () => downloadAll(Object.values(upgraded))
    console.log('Crawled resources:', upgraded)
  }
  main()
})()
