import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: string | null
}

export type SessionData = {
  user: SessionUser
  session: { id: string; expiresAt: string }
}

async function fetchSession(cookie: string | null): Promise<SessionData | null> {
  if (!cookie) return null

  try {
    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.user ? data : null
  } catch {
    return null
  }
}

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const headers = getRequestHeaders()
    const session = await fetchSession(headers.get('cookie'))

    if (!session) {
      throw new Error('Unauthorized')
    }

    return next({
      context: {
        user: session.user,
        session: session.session,
      },
    })
  },
)

export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionData | null> => {
    const headers = getRequestHeaders()
    return fetchSession(headers.get('cookie'))
  },
)

export const ensureSession = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return { user: context.user, session: context.session }
  })
