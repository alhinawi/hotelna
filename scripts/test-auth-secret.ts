import assert from 'node:assert/strict'
import { app } from '../server/app'
import { hashPassword, signToken } from '../server/auth'
let reads = 0
const DB = { prepare() { reads++; throw new Error('Unexpected database read') } }
for (const JWT_SECRET of [undefined, '', '   ', 'dev-only-secret-change-me-in-production']) {
  for (const path of ['/api/auth/login', '/api/auth/me']) {
    const login = path.endsWith('login')
    const response = await app.fetch(new Request('https://test.invalid' + path, login ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fixture@example.invalid', password: 'fixture-password' }) } : {}), { DB, JWT_SECRET } as any)
    assert.equal(response.status, 503)
    assert.equal((await response.json() as any).error, 'Authentication is temporarily unavailable')
  }
}
assert.equal(reads, 0)
const JWT_SECRET = 'test-fixture-signing-key-not-a-production-secret'
const token = await signToken({ id: 1, name: 'Fixture', role: 'admin', email: 'fixture@example.invalid' }, JWT_SECRET)
const user = { id: 1, name: 'Fixture', role: 'admin', email: 'fixture@example.invalid', active: 1, password_hash: await hashPassword('fixture-password') }
const db = { prepare() { return { bind() { return this }, async first() { return user }, async run() { return {} } } } }
const me = await app.fetch(new Request('https://test.invalid/api/auth/me', { headers: { Authorization: 'Bearer ' + token } }), { DB: db, JWT_SECRET } as any)
assert.equal(me.status, 200)
const denied = await app.fetch(new Request('https://test.invalid/api/auth/me'), { DB: db, JWT_SECRET } as any)
assert.equal(denied.status, 401)
const login = await app.fetch(new Request('https://test.invalid/api/auth/login', {method: 'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'fixture-password'})}), { DB:db, JWT_SECRET } as any)
assert.equal(login.status,200)
assert((await login.json() as any).token)
assert.equal((await app.fetch(new Request('https://test.invalid/api/health'), { DB } as any)).status,200)
console.log('PASS: missing/blank/default secrets fail503 before DB; configured login and token work; anonymous401; health200')
