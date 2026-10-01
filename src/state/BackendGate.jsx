import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient, isSupabaseConfigured } from '../data/backend'
import { createLocalRepository } from '../data/localRepository'
import { createSupabaseRepository } from '../data/supabaseRepository'
import Login from '../pages/Login'
import { SessionContext } from './contexts'

/** Picks the storage backend and renders `children(repository)`. Supabase mode requires a session. */
export function BackendGate({ children }) {
  const [useDemo, setUseDemo] = useState(false)
  if (!isSupabaseConfigured || useDemo) return <LocalBackend>{children}</LocalBackend>
  return <SupabaseBackend onUseDemo={() => setUseDemo(true)}>{children}</SupabaseBackend>
}

function LocalBackend({ children }) {
  const repository = useMemo(() => createLocalRepository(), [])
  return children(repository)
}

function SupabaseBackend({ children, onUseDemo }) {
  const [client, setClient] = useState(null)
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    let unsubscribe = () => {}
    let alive = true
    getSupabaseClient().then((c) => {
      if (!alive) return
      setClient(c)
      c.auth.getSession().then(({ data }) => alive && setSession(data.session))
      const { data } = c.auth.onAuthStateChange((_event, s) => setSession(s))
      unsubscribe = () => data.subscription.unsubscribe()
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const userId = session?.user?.id
  const repository = useMemo(() => (client && userId ? createSupabaseRepository(client) : null), [client, userId])

  if (!client || session === undefined) {
    return <div className="grid min-h-svh place-items-center text-ink2" role="status">Connecting…</div>
  }
  if (!session) return <Login client={client} onUseDemo={onUseDemo} />
  return (
    <SessionContext.Provider value={{ email: session.user.email, signOut: () => client.auth.signOut() }}>
      {children(repository, userId)}
    </SessionContext.Provider>
  )
}
