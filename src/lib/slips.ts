import path from 'path'

// สลิปการโอน = ข้อมูลการเงินของลูกค้า — เก็บ "นอก" โฟลเดอร์ public/ โดยเด็ดขาด
// เพื่อไม่ให้ Next เสิร์ฟเป็นไฟล์ static ได้ ไม่ว่าจะตั้ง proxy/Nginx อย่างไร
// (เดิมเก็บที่ public/slips/ แล้วพึ่งกฎ Nginx บล็อก /slips/ อย่างเดียว — เปราะเกินไป
//  ถ้า deploy ผิดท่าจะหลุดสาธารณะทันที). เข้าได้ทางเดียวคือ route /api/slips/<file>
// ที่เช็คสิทธิ์ (เจ้าของออเดอร์ หรือ แอดมิน). ตั้ง SLIPS_DIR=/abs/path ใน .env เพื่อ override
export const SLIPS_DIR = process.env.SLIPS_DIR
  ? path.resolve(process.env.SLIPS_DIR)
  : path.join(process.cwd(), 'private', 'slips')

// URL ที่เก็บใน DB + ใช้แสดงผล — ชี้ไป route ที่ป้องกันสิทธิ์
export function slipUrlFor(filename: string): string {
  return `/api/slips/${filename}`
}

const MIME: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  gif:  'image/gif',
}

export function mimeForFile(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}
