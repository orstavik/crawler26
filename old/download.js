async function downloadAsZip(blobs, zipName, manifest) {
  const { default: JSZip } = await import('https://cdn.skypack.dev/@progress/jszip-esm');
  const zip = new JSZip();
  blobs.forEach(b => zip.folder(b.isPage ? 'pages' : 'resources').file(b.filename, b.blob));
  if (manifest) zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(zipBlob), download: zipName }).click();
  return { compressedSize: zipBlob.size, originalSize: blobs.reduce((s, b) => s + b.size, 0) };
}

async function downloadAll(resources) {
  const entries = Object.entries(resources);
  const results = await Promise.all(entries.map(async ([url, data]) => {
    if (!data) return null;
    try {
      const isPage = data.html || (data.headers?.['content-type'] || data.contentType || '').includes('text/html');
      const blob = data.html ? new Blob([data.html], { type: 'text/html' }) : data.res ? await data.res.blob() : null;
      if (!blob) return null;
      const name = new URL(url).pathname.split('/').filter(Boolean).pop() || 'index';
      return { filename: isPage ? (name.endsWith('.html') ? name : name + '.html') : name, blob, size: blob.size, originalUrl: url, isPage: !!isPage };
    } catch { return null; }
  }));
  const blobs = results.filter(Boolean), failed = results.length - blobs.length;
  if (!blobs.length) return { total: entries.length, successful: 0, failed };
  const manifest = {
    generatedAt: new Date().toISOString(), sourcePage: location.href, sourceHostname: location.hostname, totalResources: blobs.length,
    resources: blobs.map((b, i) => ({ index: i + 1, filename: b.filename, originalUrl: b.originalUrl, isPage: b.isPage, fileSize: b.size }))
  };
  try {
    const { originalSize, compressedSize } = await downloadAsZip(blobs, `resources-${new Date().toISOString().split('T')[0]}.zip`, manifest);
    return { total: entries.length, successful: blobs.length, failed, totalBytes: originalSize, compressedBytes: compressedSize };
  } catch { return { total: entries.length, successful: 0, failed: failed + blobs.length }; }
}

export { downloadAsZip, downloadAll };
