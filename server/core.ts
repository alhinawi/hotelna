import { Hono } from 'hono'
import type { Env } from './util'
import { nowStr } from './util'

export type User = { id: number; name: string; email: string; role: string }
export type AppEnv = { Bindings: Env; Variables: { user: User } }
export const newApp = () => new Hono<AppEnv>()

export async function log(db: D1Database, user: User | null, action: string, entity: string, entityId: number | null, message: string) {
  await db.prepare('INSERT INTO activity_log (ts,user_id,user_name,action,entity,entity_id,message) VALUES (?,?,?,?,?,?,?)')
    .bind(nowStr(), user?.id ?? null, user?.name ?? 'System', action, entity, entityId, message).run()
}

export async function getSettings(db: D1Database) {
  const { results } = await db.prepare('SELECT key,value FROM settings').all<{ key: string; value: string }>()
  const o: Record<string, any> = {}
  for (const r of results) { try { o[r.key] = JSON.parse(r.value) } catch { o[r.key] = r.value } }
  return o
}

export const parseJson = (s: any, d: any = []) => { try { return typeof s === 'string' ? JSON.parse(s) : s ?? d } catch { return d } }
