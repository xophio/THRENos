export interface GalleryImage { id: string; name: string; svg: string }

const frame = (body: string, bg = '#f2f0e9') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="${bg}"/>${body}</svg>`

// Original Swiss-style compositions, drawn as SVG so they stay sharp at any zoom.
export const GALLERY: GalleryImage[] = [
  {
    id: 'circle-line', name: 'Circle and Line',
    svg: frame(`<circle cx="1050" cy="420" r="300" fill="#d62929"/><rect x="0" y="720" width="1600" height="4" fill="#202020"/><rect x="1000" y="720" width="100" height="100" fill="#202020"/><text x="90" y="900" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#202020">Circle / Line</text>`),
  },
  {
    id: 'bars', name: 'Vertical Bars',
    svg: frame(`<rect x="200" width="24" height="1000" fill="#202020"/><rect x="260" width="8" height="1000" fill="#202020"/><rect x="310" width="60" height="1000" fill="#202020"/><rect x="420" width="200" height="1000" fill="#d62929"/><rect x="680" width="12" height="1000" fill="#202020"/><rect x="740" width="90" height="1000" fill="#8c8a83"/><rect x="900" width="6" height="1000" fill="#202020"/><rect x="960" width="40" height="1000" fill="#202020"/>`),
  },
  {
    id: 'quarter', name: 'Quarter Circle',
    svg: frame(`<path d="M1600 1000 L1600 200 A800 800 0 0 0 800 1000 Z" fill="#202020"/><rect x="260" y="180" width="260" height="260" fill="#d62929"/><rect x="260" y="470" width="260" height="4" fill="#202020"/>`),
  },
  {
    id: 'grid', name: 'Grid Study',
    svg: frame(Array.from({ length: 6 }, (_, r) => Array.from({ length: 10 }, (_, c) => {
      const on = (r * 7 + c * 3) % 5 === 0
      const red = (r + c) % 11 === 0
      return `<rect x="${120 + c * 140}" y="${120 + r * 140}" width="120" height="120" fill="${red ? '#d62929' : on ? '#202020' : 'none'}" stroke="#202020" stroke-width="2"/>`
    }).join('')).join('')),
  },
  {
    id: 'charcoal', name: 'Charcoal Field',
    svg: frame(`<circle cx="800" cy="500" r="360" fill="#f2f0e9"/><circle cx="800" cy="500" r="170" fill="#d62929"/><rect x="120" y="860" width="1360" height="3" fill="#f2f0e9"/>`, '#202020'),
  },
  {
    id: 'type', name: 'Type Specimen',
    svg: frame(`<text x="100" y="620" font-family="Helvetica, Arial, sans-serif" font-size="520" font-weight="800" letter-spacing="-30" fill="#202020">Aa</text><circle cx="1280" cy="310" r="90" fill="#d62929"/><rect x="100" y="720" width="1400" height="4" fill="#202020"/><text x="100" y="800" font-family="Helvetica, Arial, sans-serif" font-size="44" fill="#202020">Helvetica Neue / Regular and Bold</text>`),
  },
]

export const svgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i
export const isImageName = (name: string) => IMAGE_EXT.test(name)

/** Turns a stored file body into something an <img> can show, or null if it is not an image. */
export function contentToSrc(content: string): string | null {
  if (content.startsWith('data:image/')) return content
  if (content.trimStart().startsWith('<svg') || content.trimStart().startsWith('<?xml')) return svgDataUrl(content)
  return null
}
