import { runPipeline } from './resource.js'
import { minifyCSS, initCSSS } from './csss.js'
import { downloadAll } from './download.js'

async function loadPage (otherHtml) {
  const document2 = new DOMParser().parseFromString(otherHtml, 'text/html')
  const thisHeadTxts = Object.fromEntries(document.head.children.map(el => [el.outerHTML, el]))
  const nextHeadTxts = Object.fromEntries(document2.head.children.map(el => [el.outerHTML, el]))
  for (let txt of new Set([...Object.keys(thisHeadTxts), ...Object.keys(nextHeadTxts)])) {
    if (txt in thisHeadTxts && txt in nextHeadTxts)
      continue
    delete thisHeadTxts[txt]
    delete nextHeadTxts[txt]
  }
  for (let toBeRemoved of Object.values(thisHeadTxts))
    toBeRemoved.remove()
  for (let toBeAdded of Object.values(nextHeadTxts))
    document.head.appendChild(toBeAdded)
  document.body.replaceWith(document2.body)
}

async function processPage (discoveredResources) {
  const shortsAdded = await minifyCSS()
  initCSSS(shortsAdded)
  for (let el of document.querySelectorAll('style:not(#csss_omg), link[rel="stylesheet"]'))
    el.remove()
  const html = document.documentElement.outerHTML
  const extra = await runPipeline(discoveredResources)
  return { html, extra }
}

async function main () {
  const discoveredResources = {
    [location.href]: { contentType: 'text/html' },
  }
  const { html, extra } = await processPage(discoveredResources)
  Object.assign(discoveredResources, extra)
  discoveredResources[location.href].html = html
  let max = 1
  for (let [url, data] of Object.entries(discoveredResources)) {
    if (!max--) break
    if (!data) continue
    if (data.res && data.headers?.['content-type']?.includes('text/html') && new URL(url).origin === location.origin) {
      const htmlRaw = await data.res.text()
      await loadPage(htmlRaw)
      const { html, extra } = await processPage(discoveredResources)
      Object.assign(discoveredResources, extra)
      discoveredResources[url].html = html
    }
  }
  console.log('Crawled resources:', discoveredResources)
  return discoveredResources
}

window.crawl = main
window.downloadAsZip = downloadAll
