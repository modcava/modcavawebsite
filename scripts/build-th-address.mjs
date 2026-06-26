// Build a compact Thai address dataset for the cascading checkout selector.
//
// Source: kongvut/thai-province-data (province → district → sub_district + zip).
// We strip everything except Thai names + zip and write a minified nested JSON
// to public/data/th-address.json. Re-run to refresh:  node scripts/build-th-address.mjs
//
// Output shape (short keys to keep the asset small):
//   [{ p: "<จังหวัด>", d: [{ n: "<อำเภอ/เขต>", s: [{ n: "<ตำบล/แขวง>", z: "10200" }] }] }]

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC =
  'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/province_with_district_and_sub_district.json'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '..', 'public', 'data', 'th-address.json')

const res = await fetch(SRC)
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
const raw = await res.json()

const compact = raw.map((prov) => ({
  p: prov.name_th,
  d: (prov.districts ?? []).map((dist) => ({
    n: dist.name_th,
    s: (dist.sub_districts ?? []).map((sub) => ({
      n: sub.name_th,
      z: String(sub.zip_code ?? '').padStart(5, '0'),
    })),
  })),
}))

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(compact), 'utf8')

const provinces = compact.length
const districts = compact.reduce((a, p) => a + p.d.length, 0)
const subs = compact.reduce((a, p) => a + p.d.reduce((b, d) => b + d.s.length, 0), 0)
console.log(`Wrote ${OUT}`)
console.log(`provinces=${provinces} districts=${districts} sub_districts=${subs}`)
