import { useState } from 'react'

const ACCESS_CODE = 'sanitas2026'

export default function AccessGate({ children }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('sanitas_access') === 'true'
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const attempt = () => {
    if (input.trim().toLowerCase() === ACCESS_CODE) {
      sessionStorage.setItem('sanitas_access', 'true')
      setUnlocked(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (unlocked) return children

  return (
    <div className="access-gate-page">
      <div className="access-gate-card">
        <h1 className="access-gate-wordmark wordmark">
          Quick-Search Formulary Navigator
        </h1>

        <div className="access-gate-desc">
          Clinical formulary reference for Sanitas care team members.
          Enter your access code to continue.
        </div>

        <input
          type="password"
          className={`access-gate-input${error ? ' is-error' : ''}`}
          value={input}
          onChange={e => { setInput(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Access code"
          autoFocus
        />

        {error && (
          <div className="access-gate-error">
            Incorrect access code. Please try again.
          </div>
        )}

        <button type="button" className="access-gate-submit" onClick={attempt}>
          Access Sanitas
        </button>

        <div className="access-gate-footer">
          For access, contact{' '}
          <a href="mailto:ahughes@mysanitas.com">ahughes@mysanitas.com</a>
        </div>
      </div>
    </div>
  )
}
