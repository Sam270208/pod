'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Workout = {
  id: number
  exercise: string
  weight: number
  reps: number
  created_at: string
}

export default function Home() {
  const router = useRouter()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserEmail(user.email || '')
    await loadWorkouts()
    setLoading(false)
  }

  async function loadWorkouts() {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else setWorkouts(data || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('workouts').insert({
      exercise,
      weight: parseInt(weight),
      reps: parseInt(reps),
      user_id: user.id,
    })
    if (error) { console.error(error); return }
    setExercise('')
    setWeight('')
    setReps('')
    loadWorkouts()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top nav */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pod</h1>
          <p className="text-xs text-gray-400 mt-0.5">{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          Sign out
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* Log workout card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Log workout
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Exercise (e.g. Squat)"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="border border-gray-200 rounded-xl p-3 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Weight (kg)"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
              <input
                className="border border-gray-200 rounded-xl p-3 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Reps"
                type="number"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-xl font-medium text-sm transition-colors"
            >
              Log workout
            </button>
          </form>
        </div>

        {/* Recent workouts */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Recent
          </h2>
          {workouts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <p className="text-gray-400 text-sm">No workouts yet.</p>
              <p className="text-gray-300 text-xs mt-1">Log your first one above.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {workouts.map((w) => (
                <li
                  key={w.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between shadow-sm"
                >
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{w.exercise}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(w.created_at).toLocaleDateString('en-AU', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      {w.weight}kg × {w.reps}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </main>
  )
}