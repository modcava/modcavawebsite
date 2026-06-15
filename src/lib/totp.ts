import crypto from 'crypto'

// ──────────────────────────────────────────────────────────────
// TOTP — Time-based One-Time Password (RFC 6238)
//
// Compatible with Google Authenticator, Authy, 1Password, Bitwarden,
// Microsoft Authenticator, etc. — uses SHA-1, 6 digits, 30s period.
//
// Dependency-free: pure Node crypto. Secrets are stored as base32
// because that's what authenticator apps consume in QR/manual entry.
// ──────────────────────────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer): string {
  let bits = ''
  for (let i = 0; i < buf.length; i++) bits += buf[i].toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, '0')
    out += BASE32_ALPHABET[parseInt(chunk, 2)]
  }
  return out
}

function base32Decode(s: string): Buffer {
  s = s.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '')
  let bits = ''
  for (const ch of s) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx < 0) throw new Error('invalid base32 character')
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

/** Generate a new TOTP secret (20 random bytes → base32, 32 chars). */
export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

/** Generate the 6-digit TOTP code for a given time (defaults to now). */
export function generateTOTP(secret: string, timeMs: number = Date.now()): string {
  const counter = Math.floor(timeMs / 30_000)
  // RFC 6238: 8-byte big-endian counter
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigInt64BE(BigInt(counter))

  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counterBuf).digest()
  // Dynamic truncation per RFC 4226
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 1_000_000).toString().padStart(6, '0')
}

/**
 * Verify a user-submitted TOTP code.
 * `window` = how many ±30s steps to accept (default 1 = accept previous/current/next).
 * This tolerates small clock drift between server and user's phone.
 */
export function verifyTOTP(secret: string, code: string, window = 1): boolean {
  if (!secret || !/^\d{6}$/.test(code)) return false
  const now = Date.now()
  for (let i = -window; i <= window; i++) {
    const expected = generateTOTP(secret, now + i * 30_000)
    // Constant-time-ish comparison
    if (expected.length === code.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true
    }
  }
  return false
}

/**
 * Build an `otpauth://` URI that authenticator apps consume directly
 * (via QR code scan). Format per Google Authenticator key URI spec.
 */
export function otpauthUrl(secret: string, accountLabel: string, issuer: string): string {
  const label = `${issuer}:${accountLabel}`
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

/**
 * Public QR-code image URL — uses api.qrserver.com (free, no key needed).
 * If that service is down, users can still set up manually via the secret string.
 */
export function qrImageUrl(otpauthUri: string, size = 200): string {
  const u = new URL('https://api.qrserver.com/v1/create-qr-code/')
  u.searchParams.set('size', `${size}x${size}`)
  u.searchParams.set('data', otpauthUri)
  return u.toString()
}
