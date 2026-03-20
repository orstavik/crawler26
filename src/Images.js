export default class Images {
  constructor() {
    this.images = {}
    this.errors = {}
    this.upgrade = {}
  }

  upgrading(u) {
    u = new URL(u)
    const patterns = [
      /^(.+)-\d{2,5}x\d{2,5}(\.[a-z]+)$/i,
      /^(.+)-scaled(\.[a-z]+)$/i,
      /^(.+)-(?:thumb|thumbnail|small|medium|large|full)(\.[a-z]+)$/i,
    ]
    for (let regex of patterns) {
      const match = u.pathname.match(regex)
      if (match) u.pathname = match[1] + match[2]
    }
    for (let param of ['w', 'width', 'resize']) {
      u.searchParams.delete(param)
    }
    return u.href
  }

  async addImage(urlString) {
    if (urlString in this.images) return true
    if (urlString in this.upgrade) return true
    if (urlString in this.errors) return false

    const upgradedUrlString = this.upgrading(urlString)

    if (upgradedUrlString !== urlString) {
      const success = await this.addImage(upgradedUrlString)
      if (success) {
        this.upgrade[urlString] = upgradedUrlString
        return true
      }
    }

    try {
      const res = await fetch(urlString, { mode: 'cors' })
      if (!res.ok) throw new Error(`Failed to fetch ${urlString}: ${res.statusText}`)

      const contentType = res.headers.get('content-type')
      const blob = await res.blob()

      this.images[urlString] = { contentType, blob }
      return true
    } catch (e) {
      this.errors[urlString] = e.message || String(e)
      return false
    }
  }
}
