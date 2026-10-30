import type { Rect, SnapRegion } from '../types'

export const SNAP_REGIONS: SnapRegion[] = [
  'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'maximize',
]

export const SNAP_LABELS: Record<SnapRegion, string> = {
  left: 'Left half',
  right: 'Right half',
  top: 'Top half',
  bottom: 'Bottom half',
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
  maximize: 'Maximize',
}

/** The rectangle a region occupies inside the work area. Sizes are rounded so halves tile exactly. */
export function regionRect(region: SnapRegion, a: Rect): Rect {
  const hw = Math.floor(a.w / 2)
  const hh = Math.floor(a.h / 2)
  const left = region.includes("left")
  const right = region.includes('right')
  const top = region.includes('top')
  const bottom = region.includes('bottom')

  if (region === 'maximize') return { ...a }

  const x = right ? a.x + hw : a.x
  const w = left || right ? (right ? a.w - hw : hw) : a.w
  const y = bottom ? a.y + hh : a.y
  const h = top || bottom ? (bottom ? a.h - hh : hh) : a.h
  return { x, y, w, h }
}

const EDGE = 12
const CORNER = 96

/**
 * The snap region under the pointer while dragging a window, or null.
 * Corners win over edges; the middle of the top edge maximizes, the bottom edge snaps to the bottom half.
 */
export function zoneAt(px: number, py: number, a: Rect): SnapRegion | null {
  const nearLeft = px <= a.x + EDGE
  const nearRight = px >= a.x + a.w - EDGE
  const nearTop = py <= a.y + EDGE
  const nearBottom = py >= a.y + a.h - EDGE
  if (!nearLeft && !nearRight && !nearTop && !nearBottom) return null

  const inLeft = px <= a.x + CORNER
  const inRight = px >= a.x + a.w - CORNER
  const inTop = py <= a.y + CORNER
  const inBottom = py >= a.y + a.h - CORNER

  if ((nearLeft || nearTop) && inLeft && inTop) return 'top-left'
  if ((nearRight || nearTop) && inRight && inTop) return 'top-right'
  if ((nearLeft || nearBottom) && inLeft && inBottom) return 'bottom-left'
  if ((nearRight || nearBottom) && inRight && inBottom) return 'bottom-right'
  if (nearLeft) return 'left'
  if (nearRight) return 'right'
  if (nearTop) return 'maximize'
  return 'bottom'
}
