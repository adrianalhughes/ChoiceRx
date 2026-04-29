import { useState } from 'react'

// Change this to any code you want — update here and redeploy
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
    <div style={{
      minHeight: '100vh', background: '#0F172A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif', padding: 24,
    }}>
      <div style={{
        background: '#1a2540', border: '1px solid #263354',
        borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontFamily: 'DM Serif Display, serif', color: '#ffffff', marginBottom: 4 }}>
            Sanitas
          </div>
          <div style={{ fontSize: 11, color: '#475569', letterSpacing: '0.5px' }}>
            Pharmacy Resources<sup style={{ color: '#4f8ef7', fontSize: 9 }}>β</sup>
          </div>
        </div>

        {/* Description */}
        <div style={{
          fontSize: 12, color: '#64748b', textAlign: 'center',
          marginBottom: 24, lineHeight: 1.6,
        }}>
          Clinical formulary reference for Sanitas care team members.
          Enter your access code to continue.
        </div>

        {/* Input */}
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Access code"
          autoFocus
          style={{
            width: '100%', background: '#0d1526',
            border: `1px solid ${error ? '#f87171' : '#2e3d65'}`,
            borderRadius: 8, padding: '10px 14px',
            fontSize: 14, color: '#e2e8f0',
            fontFamily: 'DM Sans, sans-serif', outline: 'none',
            marginBottom: 10, letterSpacing: '0.1em',
          }}
        />

        {error && (
          <div style={{ fontSize: 11, color: '#f87171', marginBottom: 8, textAlign: 'center' }}>
            Incorrect access code. Please try again.
          </div>
        )}

        <button
          onClick={attempt}
          style={{
            width: '100%', background: '#4f8ef7', border: 'none',
            borderRadius: 8, padding: '11px', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: '#ffffff',
            fontFamily: 'DM Sans, sans-serif',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#3b7de8'}
          onMouseLeave={e => e.currentTarget.style.background = '#4f8ef7'}
        >
          Access Sanitas
        </button>

        <div style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
          For access, contact{' '}
          <a href="mailto:ahughes@mysanitas.com" style={{ color: '#475569', textDecoration: 'none' }}>
            ahughes@mysanitas.com
          </a>
        </div>
      </div>
    </div>
  )
}
