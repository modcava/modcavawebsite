// Loader for the compact Thai address dataset served from /data/th-address.json.
// Built by scripts/build-th-address.mjs from kongvut/thai-province-data.
//
// Shape (short keys keep the asset small — ~350 KB):
//   [{ p: province, d: [{ n: district, s: [{ n: subdistrict, z: zip }] }] }]

export interface ThSubDistrict { n: string; z: string }
export interface ThDistrict { n: string; s: ThSubDistrict[] }
export interface ThProvince { p: string; d: ThDistrict[] }

let cache: Promise<ThProvince[]> | null = null

// Fetch once per page load and memoise. Returns [] on failure so callers can
// gracefully fall back to plain text inputs.
export function loadThaiAddress(): Promise<ThProvince[]> {
  if (cache) return cache
  cache = fetch('/data/th-address.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [] as ThProvince[])
  return cache
}
