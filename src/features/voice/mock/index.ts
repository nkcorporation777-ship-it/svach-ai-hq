// TEMPORARY — mock data on the Voice Agents pages for Upwork screenshots and
// recordings. Frontend only: nothing here reads from or writes to Supabase, and
// while this is on, Voice shows no real calls and its write actions are blocked.
// Remove by reverting this commit on master.
export const VOICE_MOCK = true

export const loadMock = () => import("./data")

export function assertNotMock() {
  if (VOICE_MOCK) throw new Error("Mock mode — nothing is saved.")
}
