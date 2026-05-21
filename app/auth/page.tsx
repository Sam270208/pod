'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-3xl font-bold">Pod</h1>
      <p className="mt-2 text-gray-600">
        {isSignUp ? 'Create an account' : 'Welcome back'}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white p-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Log in'}
        </button>
      </form>

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="mt-4 text-sm text-gray-500 underline"
      >
        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </button>
    </main>
  )
}