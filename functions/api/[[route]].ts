import { app } from '../../server/app'
export const onRequest: PagesFunction = (ctx) => app.fetch(ctx.request, ctx.env, ctx as any)
