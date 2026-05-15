'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Workout = {
  id: number
  exercise: string
  weight: number
  reps: number
  created_at: string
}

export default function Home() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  async function loadWorkouts() {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else setWorkouts(data || [])
  }

  useEffect(() => {
    loadWorkouts()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('workouts').insert({
      exercise,
      weight: parseInt(weight),
      reps: parseInt(reps),
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

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-3xl font-bold">Pod</h1>
      <p className="mt-2 text-gray-600">
        Accountability for people who train with mates.
      </p>

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