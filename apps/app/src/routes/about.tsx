import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap section-stack py-12 max-w-2xl">
      <p className="eyebrow mb-2">About</p>
      <h1 className="text-3xl font-semibold text-slate-900">Monorepo template</h1>
      <p className="story-copy mt-4 text-slate-600">
        This repository is a stripped-down scaffold: TanStack Start in <code className="text-sm">apps/app</code>
        , API handlers in <code className="text-sm">packages/functions</code>, shared domain in{' '}
        <code className="text-sm">packages/core</code>, and typed HTTP client in{' '}
        <code className="text-sm">packages/sdk</code>. Configure <code className="text-sm">infra/dns.ts</code>
        , SST secrets, and <code className="text-sm">.env</code> for your own project name and domains.
      </p>
    </main>
  )
}
