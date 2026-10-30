const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_OUTPUT_CHARS = 1_200_000 // keeps a few wallpapers inside the ~5 MB localStorage quota

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')) }
    img.src = url
  })
}

/** Downscales and recompresses an uploaded image so it can be stored in localStorage. */
export async function imageToWallpaper(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That image is larger than 20 MB.')
  const img = await loadImage(file)

  for (const maxSide of [1920, 1600, 1280, 960]) {
    const ratio = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * ratio))
    canvas.height = Math.max(1, Math.round(img.height * ratio))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is not available in this browser.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.7, 0.55]) {
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length <= MAX_OUTPUT_CHARS) return data
    }
  }
  throw new Error('That image is too detailed to store. Try a smaller one.')
}
