import Client from './Client'
const ROUTES = ['rooms', 'reservations', 'guests', 'housekeeping', 'billing', 'staff', 'reports', 'settings']
export function generateStaticParams() { return [{ slug: [] }, ...ROUTES.map((r) => ({ slug: [r] }))] }
export const dynamicParams = false
export default function Page() { return <Client /> }
