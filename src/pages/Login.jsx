import { useId, useState } from 'react'

/** Supabase email + password sign-in (only shown when Supabase is configured). */
export default function Login({ client, onUseDemo }) {
  const id = useId()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error, data } = mode === 'signin'
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password })
    setBusy(false)
    if (error) setMessage({ kind: 'error', text: error.message })
    else if (mode === 'signup' && !data.session) setMessage({ kind: 'info', text: 'Check your inbox to confirm your email, then sign in.' })
  }

  return (
    <main className="grid min-h-svh place-items-center bg-page px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold text-ink">{mode === 'signin' ? 'Sign in to SpendWise' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-ink2">Your data is stored in Supabase and visible only to you.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor={`${id}-email`} className="label">Email</label>
            <input id={`${id}-email`} type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-password`} className="label">Password</label>
            <input id={`${id}-password`} type="password" minLength={8} required className="field"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-bad' : 'text-ink2'}`}>
              {message.text}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <button type="button" className="text-accent hover:underline" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create an account' : 'I already have an account'}
          </button>
          <button type="button" className="text-ink2 hover:text-ink hover:underline" onClick={onUseDemo}>Try the demo</button>
        </div>
      </div>
    </main>
  )
}
