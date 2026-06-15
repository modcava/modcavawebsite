#!/usr/bin/env node
/**
 * db-bootstrap.mjs — idempotent setup of the test database.
 *
 * The Docker init.sql only runs ONCE on a fresh container. For existing
 * MySQL containers, run this to create `mocava_db_test` and grant the
 * application user access. Safe to re-run.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotenv() {
  const txt = readFileSync(resolve(process.cwd(), '.env'), 'utf-8')
  const out = {}
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

const env = loadDotenv()
const rootPass = env.MYSQL_ROOT_PASSWORD
const appUser  = env.MYSQL_USER || 'mocava_user'

if (!rootPass) {
  console.error('✗ MYSQL_ROOT_PASSWORD not set in .env')
  process.exit(1)
}

const SQL = `
CREATE DATABASE IF NOT EXISTS mocava_db_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON mocava_db_test.* TO '${appUser}'@'%';
FLUSH PRIVILEGES;
`.trim()

console.log('[db-bootstrap] Creating test DB on existing MySQL container…')

// Find the MySQL container (assumes docker-compose service name "mocava_mysql")
const child = spawn('docker', ['exec', '-i', 'mocava_mysql', 'mysql', `-uroot`, `-p${rootPass}`], {
  stdio: ['pipe', 'inherit', 'inherit'],
})

child.stdin.write(SQL)
child.stdin.end()

child.on('exit', (code) => {
  if (code === 0) {
    console.log('✓ mocava_db_test ready')
    console.log('')
    console.log('Next: npm run db:push:test   # create tables in test DB')
  } else {
    console.error(`✗ Failed (exit ${code}). Is the container running? Try: docker compose up -d`)
    process.exit(code ?? 1)
  }
})

child.on('error', (err) => {
  console.error('✗ Could not run docker exec:', err.message)
  console.error('  Make sure Docker is running and the container is named "mocava_mysql"')
  process.exit(1)
})
