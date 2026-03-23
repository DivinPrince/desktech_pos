import { createFileRoute, Link } from '@tanstack/react-router'
import { siteTheme } from '../lib/site-theme'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="page-wrap home-shell py-16">
      <section className="hero-panel fade-in max-w-2xl">
        <p className="eyebrow hero-eyebrow">Starter</p>
        <h1 className="hero-title">{siteTheme.brand.name}</h1>
        <p className="hero-description">{siteTheme.brand.strapline}</p>
        <p className="mt-4 text-slate-600">
          Backend: Hono on Lambda (SST), Postgres + Drizzle, Better Auth, EventBridge bus hook in{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">packages/functions/src/event</code>
          .
        </p>
        <div className="hero-actions mt-8 flex flex-wrap gap-3">
          <Link to="/demo" className="inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-white">
            Demo table (DB → API → SDK)
          </Link>
          <Link
            to="/about"
            className="inline-flex rounded-lg border border-slate-300 px-5 py-2.5 text-slate-800"
          >
            About this template
          </Link>
        </div>
      </section>
    </main>
  )
}
