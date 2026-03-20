async function downloadImagesAsZip(filesToZip, zipName = 'images.zip') {
  for (let file of filesToZip)
    file.lastModified = Date.now();
  const { downloadZip } = await import('https://cdn.jsdelivr.net/npm/client-zip/index.js');
  const zipBlob = await downloadZip(filesToZip).blob();
  const link = document.createElement('a');
  Object.assign(link, { href: URL.createObjectURL(zipBlob), download: zipName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
      const res = await fetch(url.href);
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      return !!(this.images[url.href] = res);
    } catch (e) {
      return !(this.errors[url.href] = e);
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
    origins.length || (origins = [location.origin]);
    const instance = new Resources();
    await instance.addPerformanceImages(...origins);
    return instance;
  }
}

// async function test() {
//   const resources = await Resources.make();
//   const images = Object.entries(resources.images).map(([url, input]) => ({
//     name: btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
//     input
//   }));
//   await downloadImagesAsZip(images);
// }
// test();