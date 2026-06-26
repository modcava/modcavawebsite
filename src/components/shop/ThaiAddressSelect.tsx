'use client'
import { useEffect, useMemo, useState } from 'react'
import { loadThaiAddress, type ThProvince } from '@/lib/th-address'

export interface ThaiAddressValue {
  province: string
  district: string
  subdistrict: string
  postalCode: string
}

interface Props {
  value: ThaiAddressValue
  onChange: (v: ThaiAddressValue) => void
  inputStyle?: React.CSSProperties
  labelStyle?: React.CSSProperties
  disabled?: boolean
}

// Native chevron via background image — matches the shop's select styling.
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a8978a' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\") no-repeat right 10px center"

// Make sure a saved/legacy value that isn't in the dataset still shows up.
function withValue(options: string[], v: string): string[] {
  return v && !options.includes(v) ? [v, ...options] : options
}

export function ThaiAddressSelect({ value, onChange, inputStyle, labelStyle, disabled }: Props) {
  const [data, setData] = useState<ThProvince[] | null>(null)

  useEffect(() => {
    let alive = true
    loadThaiAddress().then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [])

  const provinceOpts = useMemo(() => (data ?? []).map((p) => p.p), [data])
  const districtOpts = useMemo(() => {
    const prov = (data ?? []).find((p) => p.p === value.province)
    return prov ? prov.d.map((d) => d.n) : []
  }, [data, value.province])
  const subOpts = useMemo(() => {
    const prov = (data ?? []).find((p) => p.p === value.province)
    const dist = prov?.d.find((d) => d.n === value.district)
    return dist ? dist.s.map((s) => s.n) : []
  }, [data, value.province, value.district])

  // Resolve the postal code for a chosen subdistrict.
  function zipFor(province: string, district: string, subdistrict: string): string {
    const prov = (data ?? []).find((p) => p.p === province)
    const dist = prov?.d.find((d) => d.n === district)
    const sub = dist?.s.find((s) => s.n === subdistrict)
    return sub?.z ?? ''
  }

  const loaded = data !== null
  const hasData = (data?.length ?? 0) > 0

  const selStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    background: `${inputStyle?.background ?? '#fff'} ${CHEVRON}`,
    paddingRight: 28,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }

  // ── Fallback: dataset unavailable → plain text inputs so checkout never breaks
  if (loaded && !hasData) {
    return (
      <>
        <Field label="จังหวัด" labelStyle={labelStyle}>
          <input style={inputStyle} value={value.province} disabled={disabled}
            onChange={(e) => onChange({ ...value, province: e.target.value })} placeholder="จังหวัด" />
        </Field>
        <Field label="เขต / อำเภอ" labelStyle={labelStyle}>
          <input style={inputStyle} value={value.district} disabled={disabled}
            onChange={(e) => onChange({ ...value, district: e.target.value })} placeholder="เขต/อำเภอ" />
        </Field>
        <Field label="แขวง / ตำบล" labelStyle={labelStyle}>
          <input style={inputStyle} value={value.subdistrict} disabled={disabled}
            onChange={(e) => onChange({ ...value, subdistrict: e.target.value })} placeholder="แขวง/ตำบล" />
        </Field>
        <Field label="รหัสไปรษณีย์" labelStyle={labelStyle}>
          <input style={inputStyle} value={value.postalCode} disabled={disabled} maxLength={5}
            onChange={(e) => onChange({ ...value, postalCode: e.target.value.replace(/\D/g, '') })} placeholder="10xxx" />
        </Field>
      </>
    )
  }

  return (
    <>
      <Field label="จังหวัด" labelStyle={labelStyle}>
        <select
          style={selStyle}
          value={value.province}
          disabled={disabled || !loaded}
          onChange={(e) => onChange({ province: e.target.value, district: '', subdistrict: '', postalCode: '' })}
        >
          <option value="">{loaded ? 'เลือกจังหวัด' : 'กำลังโหลด…'}</option>
          {withValue(provinceOpts, value.province).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="เขต / อำเภอ" labelStyle={labelStyle}>
        <select
          style={selStyle}
          value={value.district}
          disabled={disabled || !value.province}
          onChange={(e) => onChange({ ...value, district: e.target.value, subdistrict: '', postalCode: '' })}
        >
          <option value="">{value.province ? 'เลือกเขต/อำเภอ' : 'เลือกจังหวัดก่อน'}</option>
          {withValue(districtOpts, value.district).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>

      <Field label="แขวง / ตำบล" labelStyle={labelStyle}>
        <select
          style={selStyle}
          value={value.subdistrict}
          disabled={disabled || !value.district}
          onChange={(e) => onChange({ ...value, subdistrict: e.target.value, postalCode: zipFor(value.province, value.district, e.target.value) })}
        >
          <option value="">{value.district ? 'เลือกแขวง/ตำบล' : 'เลือกอำเภอก่อน'}</option>
          {withValue(subOpts, value.subdistrict).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field label="รหัสไปรษณีย์" labelStyle={labelStyle}>
        <input
          style={inputStyle}
          value={value.postalCode}
          disabled={disabled}
          maxLength={5}
          inputMode="numeric"
          placeholder="เลือกตำบลเพื่อเติมอัตโนมัติ"
          onChange={(e) => onChange({ ...value, postalCode: e.target.value.replace(/\D/g, '') })}
        />
      </Field>
    </>
  )
}

function Field({ label, labelStyle, children }: { label: string; labelStyle?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}
