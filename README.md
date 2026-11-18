# Hotelna

A complete hotel property management system: dashboard, rooms, reservations (with drag-and-drop calendar), guest CRM, housekeeping and maintenance, billing, staff, reports (PDF and Excel export) and settings. Arabic (Egyptian) and English, with RTL support.

**Stack:** React + TypeScript + Vite + Tailwind CSS, Hono on Cloudflare Pages Functions, Cloudflare D1 (SQLite). Free tier only.

## Develop

```bash
npm install
npx wrangler d1 migrations apply hotelna --local
node db/seed.mjs > db/seed.sql && npx wrangler d1 execute hotelna --local --file=db/seed.sql
npm run build && npm run preview     # http://localhost:8788
```

Demo accounts (seeded): `admin@hotelna.example` / `Admin@123`, and manager, front desk, housekeeping and accountant users shown on the sign-in page.

## Roles

`admin` (everything), `manager`, `front_desk`, `housekeeping`, `accountant`. Permissions live in `shared/perms.ts` and are enforced on every API route and in the UI.

## Deploy (Cloudflare Pages)

```bash
npx wrangler d1 create hotelna            # put the id in wrangler.toml
npx wrangler d1 migrations apply hotelna --remote
npx wrangler pages secret put JWT_SECRET
npm run deploy
```

## Hotelna

Hotel management system: dashboard, rooms, reservations (drag-and-drop calendar), guests, housekeeping, billing, staff, reports (PDF and Excel), settings. English and Arabic (RTL).

- Stack: Next.js (static export), Tailwind, Hono API on Cloudflare Pages Functions, D1.
- Build: `npm ci && npm run build` (output `out`). Deploy: `wrangler pages deploy out --project-name hotelna`.
- Database: `wrangler d1 migrations apply hotelna --remote`, demo data with `node db/seed.mjs > db/seed.sql`. Set the `JWT_SECRET` Pages secret.
- Demo login: admin@hotelna.example / Admin@123.
