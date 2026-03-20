export async function downloadImagesAsZip(imagesInstance, zipName = 'images.zip') {
  const { default: JSZip } = await import('https://cdn.skypack.dev/@progress/jszip-esm')
  const zip = new JSZip()

  for (const [url, data] of Object.entries(imagesInstance.images)) {
    if (data.blob) {
      const filename = encodeURIComponent(url)
      zip.file(filename, data.blob)
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  const link = document.createElement('a')
  Object.assign(link, { href: URL.createObjectURL(zipBlob), download: zipName })
  link.click()
}
