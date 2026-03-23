import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useSession } from '../lib/auth-client'

export const Route = createFileRoute('/demo')({
  component: DemoPage,
})

function DemoPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [label, setLabel] = useState('')
  const [body, setBody] = useState('')

  const listQuery = useQuery({
    queryKey: ['demo-items'],
    queryFn: async () => {
      const res = await api.demo.list()
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.demo.create({
        label: label.trim(),
        body: body.trim() || undefined,
      })
      return res.data
    },
    onSuccess: () => {
      setLabel('')
      setBody('')
      void queryClient.invalidateQueries({ queryKey: ['demo-items'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.demo.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['demo-items'] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim() || createMutation.isPending) return
    createMutation.mutate()
  }

  const userId = session?.user?.id

  return (
    <main className="page-wrap section-stack py-12 max-w-2xl">
      <p className="eyebrow mb-2">Full stack</p>
      <h1 className="text-3xl font-semibold text-slate-900">Demo table</h1>
      <p className="mt-2 text-slate-600">
        Postgres + Drizzle (<code className="text-sm">demo_item</code>), service in{' '}
        <code className="text-sm">@repo/core/demo</code>, REST in{' '}
        <code className="text-sm">packages/functions</code>, client via{' '}
        <code className="text-sm">@repo/sdk</code>. Anyone can list; sign in to add or delete your rows
        (admins can delete any).
      </p>

      {userId ? (
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Label</span>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={200}
              placeholder="Short title"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Body (optional)</span>
            <textarea
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={3}
              placeholder="Optional details"
            />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving…' : 'Create row'}
          </button>
          {createMutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              Could not create. Check you are signed in and the API is running.
            </p>
          )}
        </form>
      ) : (
        <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sign in from the header to create or delete rows.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-800">Rows</h2>
        {listQuery.isLoading && <p className="mt-2 text-slate-500">Loading…</p>}
        {listQuery.isError && (
          <p className="mt-2 text-red-600" role="alert">
            Failed to load. Is the API up and <code className="text-sm">VITE_API_URL</code> correct?
          </p>
        )}
        {listQuery.data?.length === 0 && !listQuery.isLoading && (
          <p className="mt-2 text-slate-500">No rows yet.</p>
        )}
        <ul className="mt-4 space-y-3">
          {listQuery.data?.map((row) => {
            const canDelete =
              userId && (session?.user as { role?: string }).role === 'admin'
                ? true
                : row.createdByUserId === userId
            return (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{row.label}</p>
                  {row.body ? <p className="text-sm text-slate-600">{row.body}</p> : null}
                  <p className="mt-1 font-mono text-xs text-slate-400">{row.id}</p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(row.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
