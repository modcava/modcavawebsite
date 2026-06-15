import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider      from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { verifyTOTP } from './totp'

// ── Login lockout config ────────────────────────────────────
// MAX_ATTEMPTS=5 ภายใน window → lockedUntil = +LOCKOUT_MS
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS          = 15 * 60 * 1000  // 15 minutes

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },

  providers: [
    // ── Google OAuth ────────────────────────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Email + Password ────────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:         { label: 'Email',    type: 'email' },
        password:      { label: 'Password', type: 'password' },
        twoFactorCode: { label: '2FA Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        // ไม่มี user หรือ user นี้ login ด้วย Google เท่านั้น (ไม่มี password)
        if (!user || !user.password) return null

        // ── Lockout check ──────────────────────────────────
        // ก่อนเช็ครหัสผ่าน — ถ้ายังอยู่ในช่วงล็อก ปฏิเสธทันที (กัน timing attack ด้วย)
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000)
          throw new Error(`AccountLocked:${minutesLeft}`)
        }

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) {
          // ── Record failed attempt ─────────────────────────
          // เมื่อถึง threshold: ตั้ง lockedUntil. counter ไม่ reset จนกว่า login จะสำเร็จ
          // (ถ้าผ่าน lockedUntil ไปแล้ว ก็เริ่มสะสมใหม่ — โดย counter ยังเดิม
          //  เพื่อให้ attacker ที่ดักล็อกซ้ำ ถูกล็อกเร็วขึ้น)
          const nextAttempts = (user.failedLoginAttempts ?? 0) + 1
          const willLock     = nextAttempts >= MAX_FAILED_ATTEMPTS
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: nextAttempts,
              lockedUntil:         willLock ? new Date(Date.now() + LOCKOUT_MS) : user.lockedUntil,
            },
          })
          if (willLock) {
            throw new Error(`AccountLocked:${Math.ceil(LOCKOUT_MS / 60_000)}`)
          }
          return null
        }

        // ── Email verification gate ────────────────────────
        // OAuth users → auto-verified ผ่าน signIn callback. Credentials users
        // ต้อง verify ก่อน. (Block ที่ขั้นนี้ดีกว่าตอน checkout เพราะชัดเจน)
        if (!user.emailVerified) {
          throw new Error('EmailNotVerified')
        }

        // ── Two-factor authentication gate ─────────────────
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const code = credentials.twoFactorCode?.trim() ?? ''
          if (!code) {
            throw new Error('TwoFactorRequired')
          }
          if (!verifyTOTP(user.twoFactorSecret, code)) {
            // 2FA failure also counts toward lockout — same threshold
            const nextAttempts = (user.failedLoginAttempts ?? 0) + 1
            const willLock     = nextAttempts >= MAX_FAILED_ATTEMPTS
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: nextAttempts,
                lockedUntil:         willLock ? new Date(Date.now() + LOCKOUT_MS) : user.lockedUntil,
              },
            })
            if (willLock) {
              throw new Error(`AccountLocked:${Math.ceil(LOCKOUT_MS / 60_000)}`)
            }
            throw new Error('InvalidTwoFactorCode')
          }
        }

        // ── Success: reset lockout counter ────────────────
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data:  { failedLoginAttempts: 0, lockedUntil: null },
          })
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),
  ],

  callbacks: {
    // สร้าง user ใหม่อัตโนมัติเมื่อ login ด้วย Google ครั้งแรก
    async signIn({ account, profile }) {
      if (account?.provider === 'google' && profile?.email) {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: profile.email },
          })
          if (!existing) {
            await prisma.user.create({
              data: {
                email: profile.email,
                name:  profile.name ?? 'Google User',
                role:  'CUSTOMER',
                // Google ยืนยันอีเมลให้แล้ว → ตั้ง emailVerified เลย
                emailVerified: new Date(),
                // password: null — Google user ไม่มีรหัสผ่าน
              },
            })
          } else if (!existing.emailVerified) {
            // มี local account อยู่แล้วแต่ยัง verify ไม่ผ่าน
            // — Google ยืนยันว่าเป็นเจ้าของ email จริง ให้ verify ให้เลย
            await prisma.user.update({
              where: { id: existing.id },
              data:  { emailVerified: new Date() },
            })
          }
        } catch {
          return false
        }
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (account?.provider === 'google') {
        // Google login — ดึง id + role จาก DB
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
        })
        if (dbUser) {
          token.id   = dbUser.id
          token.role = dbUser.role
        }
      } else if (user) {
        // Credentials login
        token.id   = user.id
        token.role = (user as unknown as { role: string }).role
      }
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id   as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}
