'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Exercise = {
  exercise: string
  weight: string
  reps: string
}

type Session = {
  id: string
  created_at: string
  note: string | null
  workouts: {
    id: number
    exercise: string
    weight: number
    reps: number
  }[]
}

export default function Home() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)

  // Current session being built
  const [activeSession, setActiveSession] = useState<Exercise[]>([])
  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserEmail(user.email || '')
    await loadSessions()
    setLoading(false)
  }

  async function loadSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, workouts(*)')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) console.error(error)
    else setSessions(data || [])
  }

  function addExercise(e: React.FormEvent) {
    e.preventDefault()
    if (!exercise || !weight || !reps) return
    setActiveSession([...activeSession, { exercise, weight, reps }])
    setExercise('')
    setWeight('')
    setReps('')
  }

  async function finishSession() {
    if (activeSession.length === 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create session
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (sessionError || !sessionData) {
      console.error(sessionError)
      setSaving(false)
      return
    }

    // Insert all exercises
    const { error: workoutsError } = await supabase
      .from('workouts')
      .insert(
        activeSession.map(ex => ({
          exercise: ex.exercise,
          weight: parseInt(ex.weight),
          reps: parseInt(ex.reps),
          user_id: user.id,
          session_id: sessionData.id,
        }))
      )

    if (workoutsError) {
      console.error(workoutsError)
      setSaving(false)
      return
    }

    setActiveSession([])
    setSaving(false)
    await loadSessions()
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

        {/* Add exercise form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            {activeSession.length === 0 ? 'Start a session' : 'Add exercise'}
          </h2>

          <form onSubmit={addExercise} className="space-y-3">
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
              className="w-full bg-gray-900 hover:bg-gray-700 text-white p-3 rounded-xl font-medium text-sm transition-colors"
            >
              + Add exercise
            </button>
          </form>

          {/* Active session preview */}
          {activeSession.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                This session ({activeSession.length} exercise{activeSession.length > 1 ? 's' : ''})
              </p>
              {activeSession.map((ex, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2"
                >
                  <span className="text-sm text-gray-900">{ex.exercise}</span>
                  <span className="text-xs text-gray-500">{ex.weight}kg × {ex.reps}</span>
                </div>
              ))}
              <button
                onClick={finishSession}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 mt-2"
              >
                {saving ? 'Saving...' : '✓ Finish session'}
              </button>
            </div>
          )}
        </div>

        {/* Past sessions */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Recent sessions
          </h2>
          {sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
              <p className="text-gray-400 text-sm">No sessions yet.</p>
              <p className="text-gray-300 text-xs mt-1">Log your first one above.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleDateString('en-AU', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </span>
                    <span className="text-xs text-gray-400">
                      {s.workouts?.length || 0} exercises
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {s.workouts?.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-gray-900">{w.exercise}</span>
                        <span className="inline-flex items-center bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {w.weight}kg × {w.reps}
                        </span>
                      </div>
                    ))}
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