export const MODULES = ['dashboard', 'rooms', 'reservations', 'guests', 'housekeeping', 'billing', 'staff', 'reports', 'settings'] as const
export type Module = (typeof MODULES)[number]
export type Level = 'none' | 'read' | 'write'
export const ROLES = ['admin', 'manager', 'front_desk', 'housekeeping', 'accountant'] as const
export type Role = (typeof ROLES)[number]

const W = 'write', R = 'read', N = 'none'
export const PERMS: Record<Role, Record<Module, Level>> = {
  admin:        { dashboard: W, rooms: W, reservations: W, guests: W, housekeeping: W, billing: W, staff: W, reports: W, settings: W },
  manager:      { dashboard: W, rooms: W, reservations: W, guests: W, housekeeping: W, billing: W, staff: W, reports: W, settings: R },
  front_desk:   { dashboard: R, rooms: R, reservations: W, guests: W, housekeeping: R, billing: W, staff: N, reports: N, settings: N },
  housekeeping: { dashboard: R, rooms: R, reservations: N, guests: N, housekeeping: W, billing: N, staff: N, reports: N, settings: N },
  accountant:   { dashboard: R, rooms: N, reservations: R, guests: R, housekeeping: N, billing: W, staff: N, reports: W, settings: N },
}
export const can = (role: string, m: Module, need: 'read' | 'write' = 'read') => {
  const l = (PERMS as any)[role]?.[m] as Level | undefined
  return l === 'write' || (need === 'read' && l === 'read')
}
