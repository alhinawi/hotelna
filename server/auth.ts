const enc = new TextEncoder()
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const ITER = 100000

export async function hashPassword(pw: string, saltB64?: string) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256)
  return `${ITER}$${b64(salt)}$${b64(bits)}`
}
export async function verifyPassword(pw: string, stored: string) {
  const [, salt, hash] = stored.split('$')
  const again = await hashPassword(pw, salt)
  return again.split('$')[2] === hash
}
async function hmac(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
export async function signToken(payload: Record<string, unknown>, secret: string, ttlSec = 60 * 60 * 12) {
  const body = b64(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })))
  const sig = await crypto.subtle.sign('HMAC', await hmac(secret), enc.encode(body))
  return `${body}.${b64(sig)}`
}
export async function verifyToken(token: string, secret: string): Promise<any | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const ok = await crypto.subtle.verify('HMAC', await hmac(secret), unb64(sig), enc.encode(body))
  if (!ok) return null
  const p = JSON.parse(new TextDecoder().decode(unb64(body)))
  return p.exp > Date.now() / 1000 ? p : null
}
