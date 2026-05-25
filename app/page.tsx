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

type Profile = {
  id: string
  display_name: string | null
  color: string
}

const COLOR_PALETTE = ['green', 'blue', 'orange', 'purple', 'pink', 'teal', 'amber', 'red'] as const
type Color = typeof COLOR_PALETTE[number]

// Full Tailwind class strings (no dynamic construction — needed for purge safety)
const COLOR_CLASSES: Record<string, { avatar: string; swatch: string; ring: string }> = {
  green:  { avatar: 'bg-green-600',  swatch: 'bg-green-500',  ring: 'ring-green-500' },
  blue:   { avatar: 'bg-blue-600',   swatch: 'bg-blue-500',   ring: 'ring-blue-500' },
  orange: { avatar: 'bg-orange-500', swatch: 'bg-orange-400', ring: 'ring-orange-400' },
  purple: { avatar: 'bg-purple-600', swatch: 'bg-purple-500', ring: 'ring-purple-500' },
  pink:   { avatar: 'bg-pink-500',   swatch: 'bg-pink-400',   ring: 'ring-pink-400' },
  teal:   { avatar: 'bg-teal-600',   swatch: 'bg-teal-500',   ring: 'ring-teal-500' },
  amber:  { avatar: 'bg-amber-500',  swatch: 'bg-amber-400',  ring: 'ring-amber-400' },
  red:    { avatar: 'bg-red-500',    swatch: 'bg-red-400',    ring: 'ring-red-400' },
}

export default function Home() {
  const router = useRouter()

  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Exercise[]>([])
  const [exercise, setExercise] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)
  const [pod, setPod] = useState<Pod | null>(null)
  const [podView, setPodView] = useState<'none' | 'create' | 'join'>('none')
  const [podName, setPodName] = useState('')
  const [inviteInput, setInviteInput] = useState('')
  const [podLoading, setPodLoading] = useState(false)
  const [podError, setPodError] = useState('')
  const [showInviteCode, setShowInviteCode] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [tab, setTab] = useState<'log' | 'feed' | 'calendar' | 'members' | 'settings'>('log')
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [podMemberIds, setPodMemberIds] = useState<string[]>([])
  // Settings
  const [settingName, setSettingName] = useState('')
  const [settingColor, setSettingColor] = useState('green')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  // Calendar
  const [calViewDate, setCalViewDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d
  })
  const [calSelectedDate, setCalSelectedDate] = useState<string | null>(null)

  useEffect(() => { checkUser() }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserEmail(user.email || '')
    setUserId(user.id)
    await Promise.all([loadPod(user.id), loadSessions(), loadMyProfile(user.id)])
    setLoading(false)
  }

  async function loadMyProfile(uid: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, color')
      .eq('id', uid)
      .maybeSingle()
    if (data) {
      setSettingName(data.display_name || '')
      setSettingColor(data.color || 'green')
      setProfiles(prev => ({ ...prev, [uid]: data }))
    }
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
      const ids = data.map(m => m.user_id)
      setMemberCount(ids.length)
      setPodMemberIds(ids)
      if (ids.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name, color')
          .in('id', ids)
        if (profileData) {
          const map: Record<string, Profile> = {}
          profileData.forEach(p => { map[p.id] = p })
          setProfiles(prev => ({ ...prev, ...map }))
        }
      }
    }
  }

  async function loadSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, workouts(*)')
      .order('created_at', { ascending: false })
      .limit(200)
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
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({ user_id: user.id })
        .select()
        .single()
      if (sessionError || !sessionData) { console.error(sessionError); return }
      const { error: workoutsError } = await supabase
        .from('workouts')
        .insert(activeSession.map(ex => ({
          exercise: ex.exercise,
          weight: parseInt(ex.weight),
          reps: parseInt(ex.reps),
          user_id: user.id,
          session_id: sessionData.id,
        })))
      if (workoutsError) { console.error(workoutsError); return }
      setActiveSession([])
      await loadSessions()
      setTab('feed')
    } finally {
      setSaving(false)
    }
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
    setPodMemberIds([user.id])
    setMemberCount(1)
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

  async function saveSettings() {
    setSettingsSaving(true)
    setSettingsSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSettingsSaving(false); return }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: settingName.trim() || null,
        color: settingColor,
        email: user.email,
      }, { onConflict: 'id' })

    if (!error) {
      setProfiles(prev => ({
        ...prev,
        [user.id]: { id: user.id, display_name: settingName.trim() || null, color: settingColor }
      }))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    }
    setSettingsSaving(false)
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

  function getAvatarBg(uid: string) {
    const color = profiles[uid]?.color || 'green'
    return COLOR_CLASSES[color]?.avatar || 'bg-green-600'
  }

  function getDisplayName(uid: string) {
    if (uid === userId) return 'You'
    return profiles[uid]?.display_name || 'Pod mate'
  }

  function getInitials(uid: string) {
    if (uid === userId) {
      const name = profiles[uid]?.display_name
      return name ? name.charAt(0).toUpperCase() : 'Me'
    }
    const name = profiles[uid]?.display_name
    if (name) return name.charAt(0).toUpperCase()
    return '?'
  }

  // Returns YYYY-MM-DD in local timezone
  function toLocalDateStr(ts: string | Date) {
    return new Date(ts).toLocaleDateString('en-CA') // en-CA gives YYYY-MM-DD
  }

  // Sessions logged by the current user on a given date (local timezone)
  function sessionsForDay(dateStr: string) {
    return sessions.filter(s => s.user_id === userId && toLocalDateStr(s.created_at) === dateStr)
  }

  // Calendar computed values
  const calYear = calViewDate.getFullYear()
  const calMonth = calViewDate.getMonth()
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const calFirstDow = new Date(calYear, calMonth, 1).getDay() // 0=Sun
  const calStartOffset = (calFirstDow + 6) % 7 // shift to Monday-first
  const todayStr = toLocalDateStr(new Date())
  const today = new Date()
  const isCurrentOrFutureMonth =
    calYear > today.getFullYear() ||
    (calYear === today.getFullYear() && calMonth >= today.getMonth())

  // Only show sessions from pod members
  const feedSessions = pod
    ? sessions.filter(s => podMemberIds.length === 0 || podMemberIds.includes(s.user_id))
    : []

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
          <h1 className="text-xl font-bold text-green-700">Pod 🏋️</h1>
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
      <div className="bg-white border-b border-gray-200 px-4 flex gap-4 overflow-x-auto">
        <button
          onClick={() => setTab('log')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'log'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Log
        </button>
        <button
          onClick={() => setTab('feed')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'feed'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Feed {pod ? `· ${pod.name}` : ''}
        </button>
        <button
          onClick={() => setTab('calendar')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'calendar'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setTab('members')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'members'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Members
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'settings'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Settings
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* ── LOG TAB ── */}
        {tab === 'log' && (
          <>
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
                      <p className="text-xs text-gray-400 mt-0.5">{memberCount} member{memberCount !== 1 ? 's' : ''}</p>
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

            {pod && feedSessions.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <p className="text-gray-400 text-sm">No sessions yet in {pod.name}.</p>
                <p className="text-gray-300 text-xs mt-1">Log one or get your mates to join.</p>
              </div>
            )}

            {pod && feedSessions.length > 0 && (
              <ul className="space-y-3">
                {feedSessions.map((s) => (
                  <li key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${getAvatarBg(s.user_id)}`}>
                          {getInitials(s.user_id)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{getDisplayName(s.user_id)}</p>
                          <p className="text-xs text-gray-400">{formatDate(s.created_at)} · {formatTime(s.created_at)}</p>
                        </div>
                      </div>
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

        {/* ── CALENDAR TAB ── */}
        {tab === 'calendar' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() => {
                    setCalSelectedDate(null)
                    setCalViewDate(new Date(calYear, calMonth - 1, 1))
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none"
                >
                  ‹
                </button>
                <h2 className="text-sm font-semibold text-gray-900">
                  {calViewDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => {
                    if (!isCurrentOrFutureMonth) {
                      setCalSelectedDate(null)
                      setCalViewDate(new Date(calYear, calMonth + 1, 1))
                    }
                  }}
                  disabled={isCurrentOrFutureMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none"
                >
                  ›
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                  <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {/* Leading empty cells */}
                {Array.from({ length: calStartOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Actual days */}
                {Array.from({ length: calDaysInMonth }).map((_, i) => {
                  const day = i + 1
                  const mm = String(calMonth + 1).padStart(2, '0')
                  const dd = String(day).padStart(2, '0')
                  const dateStr = `${calYear}-${mm}-${dd}`
                  const daySessions = sessionsForDay(dateStr)
                  const hasSession = daySessions.length > 0
                  // Pod mates (not the user) who trained this day
                  const podMateSessionsDay = pod
                    ? sessions.filter(s => s.user_id !== userId && podMemberIds.includes(s.user_id) && toLocalDateStr(s.created_at) === dateStr)
                    : []
                  const hasPodMate = podMateSessionsDay.length > 0
                  const isSelected = calSelectedDate === dateStr
                  const isToday = dateStr === todayStr
                  const isFuture = dateStr > todayStr

                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (!isFuture) setCalSelectedDate(isSelected ? null : dateStr)
                      }}
                      disabled={isFuture}
                      className={`flex flex-col items-center justify-center rounded-xl mx-0.5 my-0.5 h-10 transition-colors disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-green-600 text-white'
                          : isToday
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : isFuture
                          ? 'text-gray-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs font-medium leading-none">{day}</span>
                      {(hasSession || hasPodMate) && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {hasSession && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                          )}
                          {hasPodMate && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/60' : 'bg-blue-400'}`} />
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  <span className="text-xs text-gray-400">You trained</span>
                </div>
                {pod && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                    <span className="text-xs text-gray-400">Pod mate trained</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-lg bg-green-50 border border-green-100 inline-block" />
                  <span className="text-xs text-gray-400">Today</span>
                </div>
              </div>
            </div>

            {/* Selected day detail */}
            {calSelectedDate && (() => {
              // Collect all sessions for this day from the pod (or just the user if no pod)
              const relevantIds = pod ? podMemberIds : [userId]
              const allDaySessions = sessions
                .filter(s =>
                  (relevantIds.length === 0 || relevantIds.includes(s.user_id)) &&
                  toLocalDateStr(s.created_at) === calSelectedDate
                )
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

              const labelDate = new Date(calSelectedDate + 'T12:00:00')
              return (
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2 px-1">
                    {labelDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {allDaySessions.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                      <p className="text-2xl mb-2">💤</p>
                      <p className="text-gray-400 text-sm font-medium">Rest day</p>
                      <p className="text-gray-300 text-xs mt-1">
                        {pod ? 'Nobody in the pod trained this day.' : 'No sessions logged on this day.'}
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {allDaySessions.map(s => (
                        <li key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                          {/* Who + when */}
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${getAvatarBg(s.user_id)}`}>
                              {getInitials(s.user_id)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 leading-tight">{getDisplayName(s.user_id)}</p>
                              <p className="text-xs text-gray-400">
                                🕐 {formatTime(s.created_at)} · {s.workouts?.length ?? 0} exercise{(s.workouts?.length ?? 0) !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          {/* Exercises */}
                          <div className="space-y-1.5">
                            {s.workouts?.map(w => (
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
                </div>
              )
            })()}

            {/* Prompt to tap a day */}
            {!calSelectedDate && (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">Tap any past day to see what you lifted.</p>
              </div>
            )}
          </>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <>
            {!pod ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <p className="text-gray-500 text-sm font-medium">No pod yet</p>
                <p className="text-gray-300 text-xs mt-1">Create or join a pod to see your members here.</p>
                <button
                  onClick={() => setTab('log')}
                  className="mt-4 text-green-600 text-sm font-medium hover:underline"
                >
                  Go set one up →
                </button>
              </div>
            ) : (
              <>
                <div className="px-1 mb-1">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    {pod.name} · {memberCount} member{memberCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <ul className="space-y-3">
                  {podMemberIds.map(uid => {
                    const memberSessions = sessions.filter(s => s.user_id === uid)
                    // Start of this week (Monday midnight local)
                    const now = new Date()
                    const daysSinceMonday = (now.getDay() + 6) % 7
                    const weekStart = new Date(now)
                    weekStart.setDate(now.getDate() - daysSinceMonday)
                    weekStart.setHours(0, 0, 0, 0)
                    const thisWeekCount = memberSessions.filter(
                      s => new Date(s.created_at) >= weekStart
                    ).length
                    const lastSession = memberSessions[0] // sorted desc
                    const isMe = uid === userId

                    return (
                      <li key={uid} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0 ${getAvatarBg(uid)}`}>
                            {getInitials(uid)}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {profiles[uid]?.display_name || 'Pod mate'}
                              </p>
                              {isMe && (
                                <span className="text-xs bg-green-50 text-green-600 font-medium px-1.5 py-0.5 rounded-md flex-shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                <span className="font-semibold text-gray-900">{thisWeekCount}</span> this week
                              </span>
                              <span className="text-gray-200 text-xs">·</span>
                              <span className="text-xs text-gray-500">
                                <span className="font-semibold text-gray-900">{memberSessions.length}</span> total
                              </span>
                            </div>
                            {lastSession ? (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Last: {formatDate(lastSession.created_at)}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-300 mt-0.5">No sessions yet</p>
                            )}
                          </div>
                          {/* This-week bar */}
                          {thisWeekCount > 0 && (
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              {Array.from({ length: Math.min(thisWeekCount, 7) }).map((_, i) => (
                                <span key={i} className={`w-2 h-2 rounded-full ${getAvatarBg(uid)}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Your Profile</h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1.5">Display name</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Your name (shown to pod mates)"
                    value={settingName}
                    onChange={(e) => setSettingName(e.target.value)}
                    maxLength={30}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-2">Your colour</label>
                  <div className="flex gap-2.5 flex-wrap">
                    {COLOR_PALETTE.map(color => (
                      <button
                        key={color}
                        onClick={() => setSettingColor(color)}
                        className={`w-9 h-9 rounded-full transition-transform hover:scale-110 ${COLOR_CLASSES[color].swatch} ${
                          settingColor === color
                            ? `ring-2 ring-offset-2 ${COLOR_CLASSES[color].ring} scale-110`
                            : ''
                        }`}
                        title={color.charAt(0).toUpperCase() + color.slice(1)}
                        aria-label={color}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Your mates will see your sessions with this colour in the feed.
                  </p>
                </div>

                {/* Live preview */}
                <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${COLOR_CLASSES[settingColor]?.avatar || 'bg-green-600'}`}>
                    {settingName ? settingName.charAt(0).toUpperCase() : 'Me'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{settingName || 'Your name'}</p>
                    <p className="text-xs text-gray-400">How pod mates see you</p>
                  </div>
                </div>

                <button
                  onClick={saveSettings}
                  disabled={settingsSaving}
                  className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {settingsSaving ? 'Saving…' : settingsSaved ? '✓ Saved!' : 'Save changes'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">Account</h2>
              <p className="text-xs text-gray-400 mb-4">{userEmail}</p>
              <button
                onClick={handleSignOut}
                className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 p-3 rounded-xl font-medium text-sm transition-colors"
              >
                Sign out
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
