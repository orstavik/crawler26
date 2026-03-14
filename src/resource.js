'use strict'
const safeFetch = async (url, method) => {
  try {
    const res = await fetch(url, { method, mode: 'cors' })
    if (!res.ok) throw new Error(`Failed to fetch ${url}`)
    return res
  } catch (e) {
  }
}

function upgrading (u) {
   u = new URL(u);
  const patterns = [
    /^(.+)-\d{2,5}x\d{2,5}(\.[a-z]+)$/i,
    /^(.+)-scaled(\.[a-z]+)$/i,
    /^(.+)-(?:thumb|thumbnail|small|medium|large|full)(\.[a-z]+)$/i,
  ]
  for (let regex of patterns) {
    const match = u.pathname.match(regex)
    if (match) u.pathname = match[1] + match[2]
  }
  for (let param of ['w', 'width', 'resize'])
    u.searchParams.delete(param)
  return u.href
}

async function getContent (url) {
  let res = await safeFetch(url, 'GET')
  if (!res) return res
  return { headers: Object.fromEntries(res.headers), res }
}
export async function runPipeline (found) {
  const discovered = {}
  for (let { name } of performance.getEntriesByType('resource')) {
    const url = new URL(name)
    if (url.href in found || url.origin !== location.origin)
      continue
    const upgrade = upgrading(url)
    if (upgrade !== url.href) {
      const upgradeRes = await getContent(upgrade)
      if (upgradeRes) {
        discovered[url.href] = discovered[upgrade] = upgradeRes
      continue
      }
    }
    discovered[url.href] = await getContent(url.href)
  }
  return discovered
}
