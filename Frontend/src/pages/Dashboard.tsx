import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import type { Application, ApplicationStatus } from '../types'
import { ApplicationForm } from './ApplicationForm'

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  Pending: 'text-amber-600 border-amber-600',
  Scheduled: 'text-indigo-600 border-indigo-600',
  Verified: 'text-emerald-600 border-emerald-600',
  Rejected: 'text-red-600 border-red-600',
}

const STATUS_STEPS: ApplicationStatus[] = ['Pending', 'Scheduled', 'Verified']

function StatusProgress({ status }: { status: ApplicationStatus }) {
  if (status === 'Rejected') {
    return <div className="h-1 w-32 bg-red-500 rounded-full" />
  }

  const currentIndex = STATUS_STEPS.indexOf(status)

  return (
    <div className="flex gap-1 w-32">
      {STATUS_STEPS.map((step, i) => (
        <div
          key={step}
          className={`h-1 flex-1 rounded-full ${i <= currentIndex ? 'bg-indigo-600' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

export function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([])
  const [view, setView] = useState<'list' | 'new'>('list')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadApplications() {
    setLoading(true)
    try {
      const data = await api.listMyApplications()
      setApplications(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [])

  const counts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] ?? 0) + 1
      return acc
    },
    {} as Record<ApplicationStatus, number>
  )

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-10 py-6 bg-gradient-to-r from-indigo-50 to-white">
        <h1 className="text-2xl font-semibold text-gray-900">My Applications</h1>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-gray-600 border border-gray-300 rounded-md px-4 py-2 transition-all duration-150 hover:bg-gray-900 hover:text-white hover:border-gray-900 active:scale-[0.97]"
        >
          Log out
        </button>
      </header>

      <div className="flex gap-10 px-10 mb-12 py-6 border-y border-gray-100">
        {(['Pending', 'Scheduled', 'Verified', 'Rejected'] as ApplicationStatus[]).map((status) => (
          <div key={status} className={`border-l-4 pl-4 ${STATUS_STYLES[status]}`}>
            <p className="text-4xl font-bold tabular-nums">{counts[status] ?? 0}</p>
            <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mt-1">{status}</p>
          </div>
        ))}
      </div>

      <div className="px-10 mb-8 flex gap-6 border-b border-gray-200">
        <button
          onClick={() => setView('list')}
          className={`pb-3 text-sm font-medium transition-colors ${
            view === 'list' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Applications
        </button>
        <button
          onClick={() => setView('new')}
          className={`pb-3 text-sm font-medium transition-colors ${
            view === 'new' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          New Application
        </button>
      </div>

      <main className="px-10 pb-16">
        {view === 'new' ? (
          <ApplicationForm
            onSubmitted={() => {
              setView('list')
              loadApplications()
            }}
          />
        ) : loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : applications.length === 0 ? (
          <p className="text-gray-500">No applications yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {applications.map((app) => (
              <li
                key={app.id}
                className="py-5 flex items-center justify-between hover:bg-gray-50 transition-colors px-4 -mx-4 rounded-sm"
              >
                <div>
                  <p className="text-gray-900 font-semibold">{app.instrument_type}</p>
                  <p className="text-sm text-gray-500 mt-0.5 mb-2">
                    Submitted{' '}
                    {new Date(app.submitted_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {app.is_reverification && <span className="ml-2 text-indigo-500">· Re-verification</span>}
                  </p>
                  <StatusProgress status={app.status} />
                </div>
                <div className="flex items-center gap-6">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide border-l-2 pl-2 ${STATUS_STYLES[app.status]}`}
                  >
                    {app.status}
                  </span>
                  {app.status === 'Verified' && (
                    <Link
                      to={`/certificate/${app.id}`}
                      className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
                    >
                      View certificate →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}