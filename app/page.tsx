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
    if (!user) {
      router.push('/auth')
      return
    }
    setUserEmail(user.email || '')
    loadWorkouts()
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
    if (error) {
      console.error(error)
      return
    }
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
      <main className="p-8 max-w-md mx-auto">
        <p className="text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Pod</h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 underline"
        >
          Sign out
        </button>
      </div>
      <p className="mt-1 text-gray-600 text-sm">{userEmail}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Exercise (e.g. Squat)"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          required
        />
        <input
          className="w-full border rounded p-2"
          placeholder="Weight (kg)"
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
        <input
          className="w-full border rounded p-2"
          placeholder="Reps"
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full bg-green-600 text-white p-2 rounded font-medium"
        >
          Log workout
        </button>
      </form>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Recent
        </h2>
        <ul className="mt-3 space-y-2">
          {workouts.map((w) => (
            <li key={w.id} className="border rounded p-3">
              <div className="font-medium">{w.exercise}</div>
              <div className="text-sm text-gray-600">
                {w.weight}kg × {w.reps}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}