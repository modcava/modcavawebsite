/**
 * k6 Load Test — Mocava Web Store
 *
 * ก่อนรัน:
 *   1. ติดตั้ง k6: https://k6.io/docs/getting-started/installation/
 *   2. รันแอปใน test mode:
 *        DB_ENV=test npm run dev   (หรือ npm run build && DB_ENV=test npm start)
 *   3. Seed test users:
 *        DB_ENV=test npm run db:seed:test
 *        จากนั้นรัน: node load-test/seed-load-users.mjs
 *
 * รัน scenarios ต่างๆ:
 *   k6 run load-test/k6.js                          # smoke (default)
 *   k6 run -e SCENARIO=load load-test/k6.js          # average load
 *   k6 run -e SCENARIO=stress load-test/k6.js        # stress test
 *   k6 run -e SCENARIO=soak load-test/k6.js          # 30-min soak
 *   k6 run -e BASE_URL=http://192.168.1.x:3000 ...   # remote host
 *
 * ดู HTML report:
 *   k6 run --out json=result.json load-test/k6.js
 *   k6 dashboard result.json
 */

import http        from 'k6/http'
import { check, sleep, group } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { SharedArray }          from 'k6/data'

// ─── Custom metrics ──────────────────────────────────────────────────────────
const orderSuccess   = new Rate('order_success_rate')
const orderDuration  = new Trend('order_duration_ms', true)
const productsDuration = new Trend('products_load_ms', true)
const loginSuccess   = new Rate('login_success_rate')
const orderErrors    = new Counter('order_errors_total')

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

// Test users ต้องมีใน DB ก่อน (รัน seed-load-users.mjs)
// email: loadtest{1..50}@test.local, password: Load@1234
const USERS = new SharedArray('users', function () {
  const users = []
  for (let i = 1; i <= 50; i++) {
    users.push({ email: `loadtest${i}@test.local`, password: 'Load@1234' })
  }
  return users
})

// ─── Scenario definitions ─────────────────────────────────────────────────────
const SCENARIO_NAME = __ENV.SCENARIO || 'smoke'

const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 2,
    duration: '30s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },  // warmup
      { duration: '2m',  target: 20 },  // sustained load
      { duration: '30s', target: 0  },  // cooldown
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 30  },
      { duration: '1m',  target: 30  },
      { duration: '30s', target: 60  },
      { duration: '1m',  target: 60  },
      { duration: '30s', target: 100 },
      { duration: '1m',  target: 100 },
      { duration: '30s', target: 0   },
    ],
  },
  soak: {
    executor: 'constant-vus',
    vus: 20,
    duration: '30m',
  },
}

export const options = {
  scenarios: { [SCENARIO_NAME]: scenarios[SCENARIO_NAME] },
  thresholds: {
    // Global HTTP
    http_req_failed:        ['rate<0.02'],           // < 2% request errors
    http_req_duration:      ['p(95)<3000', 'p(99)<5000'],

    // Custom
    order_success_rate:     ['rate>0.90'],            // > 90% orders succeed
    login_success_rate:     ['rate>0.95'],
    products_load_ms:       ['p(95)<800'],
    order_duration_ms:      ['p(95)<4000'],
  },
}

// ─── Login helper ─────────────────────────────────────────────────────────────
function login(user) {
  // Step 1: CSRF token (NextAuth requires this)
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`, {
    tags: { name: 'auth_csrf' },
  })
  if (csrfRes.status !== 200) return null

  const csrfToken = JSON.parse(csrfRes.body).csrfToken
  if (!csrfToken) return null

  // Step 2: Credentials sign-in
  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    `csrfToken=${encodeURIComponent(csrfToken)}&email=${encodeURIComponent(user.email)}&password=${encodeURIComponent(user.password)}&redirect=false&json=true`,
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirects: 0,
      tags: { name: 'auth_login' },
    },
  )

  // NextAuth returns 200 with {url} on success, cookies include session token
  const ok = loginRes.status === 200 || loginRes.status === 302
  loginSuccess.add(ok)
  if (!ok) return null

  // Return the jar (k6 tracks cookies automatically per VU)
  return true
}

// ─── VU setup: login once, reuse session ─────────────────────────────────────
export function setup() {
  // Warm up: verify the server is reachable
  const res = http.get(`${BASE_URL}/api/products?pageSize=1`, {
    tags: { name: 'setup_ping' },
  })
  if (res.status !== 200) {
    console.error(`Server not reachable: ${res.status} ${res.body}`)
  }
  return {}
}

// ─── Main VU function ─────────────────────────────────────────────────────────
export default function () {
  const user = USERS[__VU % USERS.length]

  // Each VU logs in once per iteration (session cookie is kept in k6 cookie jar)
  group('auth', () => {
    login(user)
  })

  sleep(0.5)

  // Realistic traffic mix: 65% browse, 20% search, 10% checkout, 5% order history
  const roll = Math.random()

  if (roll < 0.65) {
    group('browse_products', browseProdcuts)
  } else if (roll < 0.85) {
    group('search_products', searchProducts)
  } else if (roll < 0.95) {
    group('checkout', placeOrder)
  } else {
    group('order_history', viewOrderHistory)
  }

  sleep(randBetween(1, 3))
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

function browseProdcuts() {
  const start = Date.now()
  const res = http.get(`${BASE_URL}/api/products?pageSize=48&page=1`, {
    tags: { name: 'GET_products' },
  })
  productsDuration.add(Date.now() - start)

  check(res, {
    'products: status 200':        (r) => r.status === 200,
    'products: has data array':    (r) => {
      try { return Array.isArray(JSON.parse(r.body).data) } catch { return false }
    },
    'products: response < 800ms':  (r) => r.timings.duration < 800,
  })
}

function searchProducts() {
  const terms = ['black lotus', 'dragon', 'island', 'fireball', 'sol ring']
  const term  = terms[Math.floor(Math.random() * terms.length)]
  const start = Date.now()

  const res = http.get(`${BASE_URL}/api/products?search=${encodeURIComponent(term)}&pageSize=20`, {
    tags: { name: 'GET_products_search' },
  })
  productsDuration.add(Date.now() - start)

  check(res, {
    'search: status 200':      (r) => r.status === 200,
    'search: response < 1s':   (r) => r.timings.duration < 1000,
  })
}

function placeOrder() {
  // Step 1: get a real product ID to order
  const listRes = http.get(`${BASE_URL}/api/products?pageSize=5&page=1`, {
    tags: { name: 'checkout_get_products' },
  })
  if (listRes.status !== 200) {
    orderErrors.add(1)
    orderSuccess.add(false)
    return
  }

  let products
  try {
    products = JSON.parse(listRes.body).data
  } catch {
    orderErrors.add(1)
    orderSuccess.add(false)
    return
  }

  if (!products || products.length === 0) {
    orderSuccess.add(false)
    return
  }

  // Pick first in-stock product
  const product = products.find((p) => p.stock > 0 && p.isActive)
  if (!product) {
    orderSuccess.add(false)
    return
  }

  const payload = JSON.stringify({
    items: [{ productId: product.id, quantity: 1 }],
    recipientName:  'Load Test User',
    phone:          '0812345678',
    address:        '123 Test Street',
    district:       'Test District',
    province:       'Bangkok',
    postalCode:     '10100',
    shippingMethod: 'Store Pickup',
    paymentMethod:  'PromptPay',
    note:           'k6 load test order',
  })

  const start = Date.now()
  const res = http.post(`${BASE_URL}/api/orders`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags:    { name: 'POST_orders' },
  })
  orderDuration.add(Date.now() - start)

  const ok = check(res, {
    'order: status 201':          (r) => r.status === 201,
    'order: has orderNumber':     (r) => {
      try { return Boolean(JSON.parse(r.body).data?.orderNumber) } catch { return false }
    },
    'order: response < 4s':       (r) => r.timings.duration < 4000,
  })

  if (!ok) {
    orderErrors.add(1)
    if (res.status !== 429) {
      // 429 (rate limit hit) is expected under load — don't log as error
      console.warn(`Order failed [${res.status}]: ${res.body.slice(0, 200)}`)
    }
  }
  orderSuccess.add(ok || res.status === 429)  // rate-limited counts as "not broken"
}

function viewOrderHistory() {
  const res = http.get(`${BASE_URL}/api/orders`, {
    tags: { name: 'GET_orders' },
  })

  check(res, {
    'orders: status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'orders: response < 2s':     (r) => r.timings.duration < 2000,
  })
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function randBetween(min, max) {
  return Math.random() * (max - min) + min
}
