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
  const [tab, setTab] = useState<'log' | 'feed' | 'settings'>('log')
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [podMemberIds, setPodMemberIds] = useState<string[]>([])
  // Settings
  const [settingName, setSettingName] = useState('')
  const [settingColor, setSettingColor] = useState('green')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

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
      // Load profiles for all members
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
        <button
          onClick={() => setTab('settings')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${
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
