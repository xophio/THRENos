import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../utils'

export interface CustomWallpaper { id: string; name: string; dataUrl: string }

export const MAX_CUSTOM_WALLPAPERS = 3

interface WallpaperState {
  images: CustomWallpaper[]
  /** Returns an error message, or null on success. */
  add: (name: string, dataUrl: string) => string | null
  remove: (id: string) => void
}

// Uploaded images live under their own storage key so settings writes stay small.
export const useCustomWallpapers = create<WallpaperState>()(
  persist(
    (set, get) => ({
      images: [],
      add: (name, dataUrl) => {
        if (get().images.length >= MAX_CUSTOM_WALLPAPERS) return `You can keep up to ${MAX_CUSTOM_WALLPAPERS} custom wallpapers. Remove one first.`
        const prev = get().images
        try {
          set({ images: [...prev, { id: uid(), name, dataUrl }] })
        } catch {
          set({ images: prev })
          return 'Not enough browser storage for this image.'
        }
        return null
      },
      remove: (id) => set((s) => ({ images: s.images.filter((i) => i.id !== id) })),
    }),
    { name: 'threnos-wallpapers' },
  ),
)

export const customWallpaperId = (id: string) => `custom:${id}`
