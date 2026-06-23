// Thai column headers + descriptions for each sales-export report, in output
// order. Shared by the CSV route (header row) and the /admin/reports column
// dictionary so the two never drift apart.

export type ReportType = 'summary' | 'category' | 'product'

type Col = { header: string; desc: string }

// Report A — one row per period (week / month / year).
const SUMMARY: Col[] = [
  { header: 'ช่วงเวลา',            desc: 'เช่น มิถุนายน 2026 หรือ สัปดาห์ที่ 26/2026' },
  { header: 'วันเริ่ม',             desc: 'วันแรกของช่วง' },
  { header: 'วันสิ้นสุด',           desc: 'วันสุดท้ายของช่วง' },
  { header: 'จำนวนออเดอร์',         desc: 'จำนวนออเดอร์' },
  { header: 'จำนวนชิ้น',            desc: 'จำนวนสินค้าที่ขายได้' },
  { header: 'ยอดขายสินค้า',         desc: 'ราคา × จำนวน (ก่อนหัก)' },
  { header: 'ส่วนลด',               desc: 'ส่วนลดรวม' },
  { header: 'ค่าส่ง',               desc: 'ค่าจัดส่งรวม' },
  { header: 'ชาร์จบัตรเครดิต',       desc: 'ค่าธรรมเนียมบัตรเครดิตรวม' },
  { header: 'ยอดสุทธิ',             desc: 'ยอดที่ลูกค้าจ่ายจริง' },
  { header: 'ต้นทุนสินค้า',          desc: 'ทุน × จำนวน' },
  { header: 'กำไรขั้นต้น',           desc: 'ยอดขายสินค้า − ต้นทุน' },
  { header: 'อัตรากำไร %',           desc: '% กำไรขั้นต้น' },
  { header: 'ค่าคอมมิชชั่น',         desc: 'ค่าคอมอินฟลูเอนเซอร์รวม' },
  { header: 'ยอดเฉลี่ยต่อออเดอร์',   desc: 'ยอดสุทธิ ÷ จำนวนออเดอร์' },
  { header: 'ความครบของต้นทุน %',    desc: '% ชิ้นที่มีข้อมูลทุน (ยิ่งสูงยิ่งแม่น)' },
]

// Report B — one row per (period × หมวดสินค้า), เรียงหมวดขายดีก่อนในแต่ละช่วง.
const CATEGORY: Col[] = [
  { header: 'ช่วงเวลา',            desc: 'เช่น มิถุนายน 2026' },
  { header: 'วันเริ่ม',             desc: 'วันแรกของช่วง' },
  { header: 'วันสิ้นสุด',           desc: 'วันสุดท้ายของช่วง' },
  { header: 'หมวดสินค้า',           desc: 'หมวดของสินค้า' },
  { header: 'จำนวนออเดอร์',         desc: 'จำนวนออเดอร์ที่มีหมวดนี้' },
  { header: 'จำนวนชิ้น',            desc: 'จำนวนชิ้นของหมวดนี้' },
  { header: 'ยอดขายสินค้า',         desc: 'ราคา × จำนวน' },
  { header: 'ต้นทุนสินค้า',          desc: 'ทุน × จำนวน' },
  { header: 'กำไรขั้นต้น',           desc: 'ยอดขาย − ต้นทุน' },
  { header: 'อัตรากำไร %',           desc: '% กำไรขั้นต้น' },
  { header: 'สัดส่วนยอดขาย %',       desc: '% ของยอดขายทั้งช่วงนั้น' },
  { header: 'ความครบของต้นทุน %',    desc: '% ชิ้นที่มีข้อมูลทุน' },
]

// Report C — one row per (period × สินค้ารายตัว), เรียงสินค้าขายดีก่อนในแต่ละช่วง.
const PRODUCT: Col[] = [
  { header: 'ช่วงเวลา',            desc: 'เช่น มิถุนายน 2026' },
  { header: 'วันเริ่ม',             desc: 'วันแรกของช่วง' },
  { header: 'วันสิ้นสุด',           desc: 'วันสุดท้ายของช่วง' },
  { header: 'รหัสสินค้า',           desc: 'SKU' },
  { header: 'ชื่อสินค้า',            desc: 'ชื่อสินค้า' },
  { header: 'หมวดสินค้า',           desc: 'หมวดของสินค้า' },
  { header: 'จำนวนออเดอร์',         desc: 'จำนวนออเดอร์ที่มีสินค้านี้' },
  { header: 'จำนวนชิ้น',            desc: 'จำนวนชิ้นที่ขายได้' },
  { header: 'ยอดขายสินค้า',         desc: 'ราคา × จำนวน' },
  { header: 'ทุน/ชิ้น',             desc: 'ต้นทุนต่อชิ้น (ว่าง = ยังไม่กรอกทุน)' },
  { header: 'กำไรขั้นต้น',           desc: 'ยอดขาย − ต้นทุน (ว่างถ้าไม่มีทุน)' },
  { header: 'อัตรากำไร %',           desc: '% กำไรขั้นต้น' },
  { header: 'สัดส่วนยอดขาย %',       desc: '% ของยอดขายทั้งช่วงนั้น' },
]

export const REPORT_COLUMNS: Record<ReportType, Col[]> = { summary: SUMMARY, category: CATEGORY, product: PRODUCT }

export const REPORT_LABELS: Record<ReportType, string> = {
  summary: 'สรุปรวม',
  category: 'แยกตามหมวด',
  product: 'แยกตามสินค้า',
}
