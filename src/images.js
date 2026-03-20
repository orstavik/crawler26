async function downloadImagesAsZip(imagesInstance, zipName = 'images.zip') {
  const { default: JSZip } = await import('https://cdn.skypack.dev/@progress/jszip-esm');
  const zip = new JSZip();

  for (const [url, data] of Object.entries(imagesInstance.images))
    if (data.blob)
      zip.file(encodeURIComponent(url), data.blob);

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const link = document.createElement('a');
  Object.assign(link, { href: URL.createObjectURL(zipBlob), download: zipName });
  link.click();
}

class Resources {
  errors = {};
  upgrades = {};
  images = {};

  upgrade(u) {
    u = new URL(u);
    const patterns = [
      /^(.+)-\d{2,5}x\d{2,5}(\.[a-z]+)$/i,
      /^(.+)-scaled(\.[a-z]+)$/i,
      /^(.+)-(?:thumb|thumbnail|small|medium|large|full)(\.[a-z]+)$/i,
    ];
    for (let regex of patterns) {
      const match = u.pathname.match(regex);
      if (match) u.pathname = match[1] + match[2];
    }
    for (let param of ['w', 'width', 'resize'])
      u.searchParams.delete(param);
    return u;
  }

  async addLink(url) {
    if (url in this.errors) return false;
    if ((url in this.upgrades) || (url in this.images)) return true;
    const up = this.upgrade(url);
    if (up.href !== url.href && await this.addLink(up))
      return !!(this.upgrades[url.href] = up.href);
    try {
      const res = await fetch(url.href, { method: 'HEAD' });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      this.images[url.href] = {
        contentType: res.headers.get('content-type'),
        blob: await res.blob()
      };
      return true;
    } catch (e) {
      this.errors[url.href] = e;
      return false;
    }
  }

  async addPerformanceImages(...origins) {
    const images = performance.getEntriesByType('resource')
      .filter(({ initiatorType }) => initiatorType === 'img')
      .map(({ name }) => new URL(name))
      .filter(url => origins.includes(url.origin));
    await Promise.all(images.map(url => this.addLink(url)));
  }

  static async make(...origins) {
    const instance = new Resources();
    await instance.addPerformanceImages(...origins);
    return instance;
  }
}