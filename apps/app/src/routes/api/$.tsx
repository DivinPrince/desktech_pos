import { createFileRoute } from '@tanstack/react-router'

const API_URL = process.env.API_URL

if (!API_URL) {
  throw new Error('API_URL is required for the frontend API proxy')
}

async function proxy(request: Request, splat: string): Promise<Response> {
  const url = new URL(request.url)
  const target = `${API_URL}/api/${splat}${url.search}`

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-forwarded-host', url.host)

  const init: RequestInit & { duplex?: string } = {
    method: request.method,
    headers,
  }

  if (request.body && !['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body
    init.duplex = 'half'
  }

  const upstream = await fetch(target, init)

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('content-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: ({ request, params }) => proxy(request, params._splat ?? ''),
      POST: ({ request, params }) => proxy(request, params._splat ?? ''),
      PUT: ({ request, params }) => proxy(request, params._splat ?? ''),
      PATCH: ({ request, params }) => proxy(request, params._splat ?? ''),
      DELETE: ({ request, params }) => proxy(request, params._splat ?? ''),
    },
  },
})
