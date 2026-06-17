import path from 'path'

// สลิปการโอนเก็บบนดิสก์ที่ public/slips/ แต่ "ห้ามเสิร์ฟแบบสาธารณะ" —
// ต้องเข้าผ่าน route /api/slips/<file> ที่เช็คสิทธิ์ (เจ้าของออเดอร์ หรือ แอดมิน) เท่านั้น
// (path เดิม /slips/ ถูกบล็อกที่ Nginx — ดู DEPLOY.md)
export const SLIPS_DIR = path.join(process.cwd(), 'public', 'slips')

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
