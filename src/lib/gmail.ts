/**
 * Gmail API helper — ใช้ OAuth2 ส่งเมลผ่าน Gmail
 * Token ถูก save ลง gmail-token.json (root project)
 */
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const TOKEN_PATH = path.join(process.cwd(), 'gmail-token.json')

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/admin/gmail-callback`,
  )
}

export function getAuthUrl() {
  const auth = getOAuth2Client()
  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
  })
}

export function loadToken(): { refresh_token: string } | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'))
    }
  } catch { /* ignore */ }
  return null
}

export function saveToken(token: object) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2))
}

/** สร้าง raw email string แบบ RFC 2822 แล้ว base64url encode */
function buildRaw({
  to,
  subject,
  html,
  from,
}: {
  to: string
  subject: string
  html: string
  from: string
}) {
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`
  const bodyB64 = Buffer.from(html).toString('base64')

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
  ].join('\r\n')

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendEmailViaGmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const token = loadToken()
  if (!token?.refresh_token) {
    throw new Error('NO_TOKEN')
  }

  const auth = getOAuth2Client()
  auth.setCredentials({ refresh_token: token.refresh_token })

  const gmail = google.gmail({ version: 'v1', auth })
  const from  = process.env.GMAIL_SENDER_EMAIL ?? ''

  const raw = buildRaw({ to, subject, html, from })

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })

  return res.data
}
