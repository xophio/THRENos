/**
 * Which profile's data the stores currently point at, and how that profile's storage keys are named.
 *
 * The first profile ever created is the primary one and keeps the original, unsuffixed keys
 * (`threnos-fs`, `threnos-notes`, …), so data saved before profiles existed simply belongs to it.
 * Every other profile gets `<key>@<profileId>`.
 */

export const PRIMARY_PROFILE = 'main'

let active: string | null = null

export const getActiveProfileId = () => active
export const setActiveProfileId = (id: string | null) => { active = id }

export const scopedKey = (base: string, id: string) => (id === PRIMARY_PROFILE ? base : `${base}@${id}`)
