import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    try {
      await api.logLoginAttempt(email, !authError, authError?.message)
    } catch {
      // audit log failure shouldn't block login flow
    }

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex w-2/5 bg-[#1e1b4b] flex-col justify-center p-12 pt-24 text-white">
        <div className="text-2xl font-semibold tracking-wide absolute top-12 left-12">True Scale</div>
        <div>
          <h2 className="text-4xl font-semibold leading-snug mb-4">
            Every measurement verified.<br />Every transaction trusted.
          </h2>
          <p className="text-indigo-100 text-sm max-w-xs">
            Track your applications, certificates, and verification status.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-white">
        <form onSubmit={handleSubmit} className="w-full max-w-sm px-8">
          <div className="h-1 w-12 bg-indigo-600 mb-6" />
          <h1 className="text-3xl font-semibold mb-8 text-gray-900">Sign in</h1>

          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent transition-colors"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent transition-colors"
          />

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-medium py-3 rounded-md transition-all duration-150 hover:bg-indigo-700 hover:shadow-none active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-sm text-gray-500 mt-6 text-center">
            New here?{' '}
            <a href="/signup" className="text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
              Create an account
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}