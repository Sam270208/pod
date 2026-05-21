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
  user_id: string
  user_email?: string
  workouts: {
    id: number
    exercise: string
    weight: number
    reps: number
  }[]
}

type Pod = {
  id: string
  name: string
  invite_code: string
}

export default function Home() {
  const router = useRouter()

  // Auth
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([])

  // Active workout
  const [activeSession, setActiveSession] = useState<Exercise[]>([])
  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)

  // Pod
  const [pod, setPod] = useState<Pod | null>(null)
  const [podView, setPodView] = useState<'none' | 'create' | 'join'>('none')
  const [podName, setPodName] = useState('')
  const [inviteInput, setInviteInput] = useState('')
  const [podLoading, setPodLoading] = useState(false)
  const [podError, setPodError] = useState('')
  const [showInviteCode, setShowInviteCode] = useState(false)
  const [memberEmails, setMemberEmails] = useState<string[]>([])

  // Tab
  const [tab, setTab] = useState<'log' | 'feed'>('log')

  useEffect(() => { checkUser() }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserEmail(user.email || '')
    setUserId(user.id)
    await Promise.all([loadPod(user.id), loadSessions()])
    setLoading(false)
  }

  async function loadPod(uid: string) {
    const { data } = await supabase
      .from('pod_members')
      .select('pod_id, pods(id, name, invite_code)')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle()

    if (data?.pods) {
      const p = data.pods as unknown as Pod
      setPod(p)
      await loadMembers(p.id)
    }
  }

  async function loadMembers(podId: string) {
    const { data } = await supabase
      .from('pod_members')
      .select('user_id')
      .eq('pod_id', podId)

    if (data) {
      setMemberEmails(data.map((m: { user_id: string }) => m.user_id))
    }
  }

  async function loadSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, workouts(*)')
      .order('created_at', { ascending: false })
      .limit(30)
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
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .insert({ user_id: user.id })
      .select()
      .single()
    if (sessionError || !sessionData) { console.error(sessionError); setSaving(false); return }
    const { error: workoutsError } = await supabase
      .from('workouts')
      .insert(activeSession.map(ex => ({
        exercise: ex.exercise,
        weight: parseInt(ex.weight),
        reps: parseInt(ex.reps),
        user_id: user.id,
        session_id: sessionData.id,
      })))
    if (workoutsError) { console.error(workoutsError); setSaving(false); return }
    setActiveSession([])
    setSaving(false)
    await loadSessions()
    setTab('feed')
  }

  async function createPod() {
    if (!podName.trim()) return
    setPodLoading(true)
    setPodError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: newPod, error: podErr } = await supabase
      .from('pods')
      .insert({ name: podName.trim(), created_by: user.id })
      .select()
      .single()

    if (podErr || !newPod) {
      setPodError('Could not create pod. Try again.')
      setPodLoading(false)
      return
    }

    const { error: memberErr } = await supabase
      .from('pod_members')
      .insert({ pod_id: newPod.id, user_id: user.id })

    if (memberErr) {
      setPodError('Pod created but could not add you as member.')
      setPodLoading(false)
      return
    }

    setPod(newPod)
    setMemberEmails([user.id])
    setPodView('none')
    setPodName('')
    setPodLoading(false)
    setShowInviteCode(true)
  }

  async function joinPod() {
    if (!inviteInput.trim()) return
    setPodLoading(true)
    setPodError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: foundPod, error: findErr } = await supabase
      .from('pods')
      .select('*')
      .eq('invite_code', inviteInput.trim().toLowerCase())
      .single()

    if (findErr || !foundPod) {
      setPodError('Invalid invite code. Check with your mate.')
      setPodLoading(false)
      return
    }

    const { error: joinErr } = await supabase
      .from('pod_members')
      .insert({ pod_id: foundPod.id, user_id: user.id })

    if (joinErr) {
      setPodError('Could not join pod. You may already be a member.')
      setPodLoading(false)
      return
    }

    setPod(foundPod)
    await loadMembers(foundPod.id)
    await loadSessions()
    setPodView('none')
    setInviteInput('')
    setPodLoading(false)
    setTab('feed')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short'
    })
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-AU', {
      hour: '2-digit', minute: '2-digit'
    })
  }

  function isMySession(s: Session) {
    return s.user_id === userId
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
      {/* Header */}
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

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-4">
        <button
          onClick={() => setTab('log')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'log'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Log
        </button>
        <button
          onClick={() => setTab('feed')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'feed'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Feed {pod ? `· ${pod.name}` : ''}
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* ── LOG TAB ── */}
        {tab === 'log' && (
          <>
            {/* Workout logger */}
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

              {activeSession.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                    This session ({activeSession.length} exercise{activeSession.length > 1 ? 's' : ''})
                  </p>
                  {activeSession.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
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

            {/* Pod panel */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              {pod ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{pod.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{memberEmails.length} member{memberEmails.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => setShowInviteCode(!showInviteCode)}
                      className="text-xs text-green-600 font-medium hover:underline"
                    >
                      {showInviteCode ? 'Hide code' : 'Invite mates'}
                    </button>
                  </div>
                  {showInviteCode && (
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-400 mb-1">Invite code</p>
                      <p className="text-3xl font-bold tracking-widest text-gray-900 font-mono">
                        {pod.invite_code.toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">Share this with your mates — they enter it to join your pod</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">Your Pod</h2>
                  <p className="text-xs text-gray-400 mb-4">Create a pod or join a mate's to see their sessions.</p>

                  {podView === 'none' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPodView('create')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl font-medium text-sm transition-colors"
                      >
                        Create pod
                      </button>
                      <button
                        onClick={() => setPodView('join')}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 p-2.5 rounded-xl font-medium text-sm transition-colors"
                      >
                        Join pod
                      </button>
                    </div>
                  )}

                  {podView === 'create' && (
                    <div className="space-y-3">
                      <input
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Pod name (e.g. Monday crew)"
                        value={podName}
                        onChange={(e) => setPodName(e.target.value)}
                      />
                      {podError && <p className="text-red-500 text-xs">{podError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={createPod}
                          disabled={podLoading}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                        >
                          {podLoading ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          onClick={() => { setPodView('none'); setPodError('') }}
                          className="flex-1 bg-gray-100 text-gray-600 p-2.5 rounded-xl font-medium text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {podView === 'join' && (
                    <div className="space-y-3">
                      <input
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono uppercase tracking-widest"
                        placeholder="INVITE CODE"
                        value={inviteInput}
                        onChange={(e) => setInviteInput(e.target.value)}
                        maxLength={6}
                      />
                      {podError && <p className="text-red-500 text-xs">{podError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={joinPod}
                          disabled={podLoading}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                        >
                          {podLoading ? 'Joining...' : 'Join'}
                        </button>
                        <button
                          onClick={() => { setPodView('none'); setPodError('') }}
                          className="flex-1 bg-gray-100 text-gray-600 p-2.5 rounded-xl font-medium text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── FEED TAB ── */}
        {tab === 'feed' && (
          <>
            {!pod && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <p className="text-gray-500 text-sm font-medium">No pod yet</p>
                <p className="text-gray-300 text-xs mt-1">Create or join a pod to see your mates' sessions here.</p>
                <button
                  onClick={() => setTab('log')}
                  className="mt-4 text-green-600 text-sm font-medium hover:underline"
                >
                  Go set one up →
                </button>
              </div>
            )}

            {pod && sessions.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <p className="text-gray-400 text-sm">No sessions yet in {pod.name}.</p>
                <p className="text-gray-300 text-xs mt-1">Log one or get your mates to join.</p>
              </div>
            )}

            {pod && sessions.length > 0 && (
              <ul className="space-y-3">
                {sessions.map((s) => (
                  <li key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${isMySession(s) ? 'bg-green-600' : 'bg-gray-400'}`}>
                          {isMySession(s) ? 'Me' : '?'}
                        </div>
                        <span className="text-xs text-gray-500">
                          {isMySession(s) ? 'You' : 'Pod mate'} · {formatDate(s.created_at)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatTime(s.created_at)}</span>
                    </div>
                    <div className="space-y-1.5">
                      {s.workouts?.map((w) => (
                        <div key={w.id} className="flex items-center justify-between">
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
          </>
        )}
      </div>
    </main>
  )
}