import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    navigate('/login')
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex w-2/5 bg-emerald-800 flex-col justify-center p-12 pt-24 text-white">
        <div className="text-2xl font-semibold tracking-wide absolute top-12 left-12">True Scale</div>
        <div>
          <h2 className="text-4xl font-semibold leading-tight mb-4">
            Get your instrument<br />certified, digitally.
          </h2>
          <p className="text-emerald-100 text-sm max-w-xs">
            One account for applications, scheduling, and certificates.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-white">
        <form onSubmit={handleSubmit} className="w-full max-w-sm px-8">
          <div className="h-1 w-12 bg-emerald-600 mb-6" />
          <h1 className="text-3xl font-semibold mb-8 text-gray-900">Create account</h1>

          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border-b-2 border-gray-300 focus:border-emerald-600 outline-none py-2 mb-6 bg-transparent transition-colors"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border-b-2 border-gray-300 focus:border-emerald-600 outline-none py-2 mb-6 bg-transparent transition-colors"
          />

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-medium py-3 rounded-md transition-all duration-150 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-sm text-gray-500 mt-6 text-center">
            Already have an account?{' '}
            <a href="/login" className="text-emerald-600 font-medium hover:text-emerald-800 transition-colors">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}