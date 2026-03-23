const { downloadZip } = await import('https://cdn.jsdelivr.net/npm/client-zip/index.js');

function download(blob, fileName = 'images.zip') {
  const link = document.createElement('a');
  Object.assign(link, { href: URL.createObjectURL(blob), download: fileName });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export class Images {
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

  async addPlaywrightResponse(pwResponse) {
    const url = new URL(pwResponse.url());
    if (url.href in this.errors) return false;
    if ((url.href in this.upgrades) || (url.href in this.images)) return true;
    
    const up = this.upgrade(url.href);
    if (up.href !== url.href && await this.addLink(up))
      return (this.upgrades[url.href] = up.href), true;

    try {
      const status = pwResponse.status();
      if (status >= 400) 
        throw new Error(status + ' ' + pwResponse.statusText());
      return !!(this.images[url.href] = await pwResponse.body());
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

  zipBlob() {
    const filesToZip = Object.entries(this.images).map(([url, input]) => ({
      name: btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      lastModified: Date.now(),
      input
    }));
    return downloadZip(filesToZip).blob();
  }

  async denoSaveZipToDownloads(filename = 'Images.zip') {
    const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    const dest = `${home}/Downloads/${filename}`;
    const blob = await this.zipBlob();
    const arrayBuffer = await blob.arrayBuffer();
    await Deno.writeFile(dest, new Uint8Array(arrayBuffer));
    console.log(`Saved images to ${dest}`);
  }

  static async make(...origins) {
    origins.length || (origins = [location.origin]);
    const instance = new Images();
    await instance.addPerformanceImages(...origins);
    return instance;
  }
}

async function test() {
  debugger;
  const images = await Images.make();
  debugger;
  download(await images.zipBlob());
}
// test();