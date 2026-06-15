#!/usr/bin/env node
/**
 * prisma-env.mjs — run Prisma (or seed) against a chosen DB environment.
 *
 * Usage:
 *   node scripts/prisma-env.mjs <prod|test> <command> [extra prisma args…]
 *
 * Commands (friendly aliases):
 *   push       → prisma db push
 *   studio     → prisma studio
 *   reset      → prisma migrate reset --force
 *   migrate    → prisma migrate dev
 *   generate   → prisma generate
 *   seed       → tsx prisma/seed.ts
 *
 * Reads `.env` to find DATABASE_URL_PROD and DATABASE_URL_TEST. The chosen
 * URL is exported as DATABASE_URL for the spawned child process — so Prisma
 * CLI sees only that one URL and treats it as the active datasource.
 *
 * Cross-platform: pure Node, no shell-dependent syntax.
 */
import { spawn }       from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve }     from 'node:path'

const [envArg, command, ...extra] = process.argv.slice(2)

if (!envArg || !['prod', 'test'].includes(envArg)) {
  console.error('Usage: node scripts/prisma-env.mjs <prod|test> <command> [args…]')
  console.error('Commands: push | studio | reset | migrate | generate | seed')
  process.exit(1)
}

// ── Parse .env ────────────────────────────────────────────────
function loadDotenv() {
  try {
    const txt = readFileSync(resolve(process.cwd(), '.env'), 'utf-8')
    const out = {}
    for (const line of txt.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!m) continue
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      out[m[1]] = val
    }
    return out
  } catch {
    return {}
  }
}

const env = loadDotenv()

// Pick URL: prefer specific *_PROD / *_TEST, fall back to DATABASE_URL
const url = envArg === 'test'
  ? (process.env.DATABASE_URL_TEST || env.DATABASE_URL_TEST)
  : (process.env.DATABASE_URL_PROD || env.DATABASE_URL_PROD || env.DATABASE_URL)

if (!url) {
  const missingVar = envArg === 'test' ? 'DATABASE_URL_TEST' : 'DATABASE_URL_PROD'
  console.error(`✗ Missing ${missingVar} in .env`)
  console.error(`  Add it to .env (see .env.example for the recommended format)`)
  process.exit(1)
}

// ── Command map (friendly aliases → actual binaries) ──────────
const COMMANDS = {
  push:     { bin: 'npx', args: ['prisma', 'db', 'push'] },
  studio:   { bin: 'npx', args: ['prisma', 'studio'] },
  reset:    { bin: 'npx', args: ['prisma', 'migrate', 'reset', '--force'] },
  migrate:  { bin: 'npx', args: ['prisma', 'migrate', 'dev'] },
  generate: { bin: 'npx', args: ['prisma', 'generate'] },
  seed:     { bin: 'npx', args: ['tsx', 'prisma/seed.ts'] },
}

const cmd = COMMANDS[command]
if (!cmd) {
  console.error(`✗ Unknown command: ${command}`)
  console.error(`  Valid: ${Object.keys(COMMANDS).join(' | ')}`)
  process.exit(1)
}

// ── Show what we're doing (mask password) ─────────────────────
const masked = url.replace(/:[^@/]+@/, ':***@')
console.log(`[prisma-env] DB=${envArg.toUpperCase()}  →  ${masked}`)
console.log(`[prisma-env] running: ${cmd.bin} ${[...cmd.args, ...extra].join(' ')}`)
console.log('')

// ── Spawn child with overridden DATABASE_URL ──────────────────
const child = spawn(cmd.bin, [...cmd.args, ...extra], {
  stdio: 'inherit',
  shell: process.platform === 'win32',  // Windows needs shell for `npx`
  env: {
    ...process.env,
    DATABASE_URL: url,
    DB_ENV:       envArg,
  },
})

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error('✗ Failed to spawn child process:', err.message)
  process.exit(1)
})
