export const uid = () => Math.random().toString(36).slice(2, 10)

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
