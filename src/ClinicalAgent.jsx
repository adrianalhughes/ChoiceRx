import { useState, useRef, useEffect } from 'react'

const BenzeneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer hexagon bonds */}
    <polygon points="50,8 85,28 85,72 50,92 15,72 15,28" fill="none" stroke="url(#blueGrad)" strokeWidth="7" strokeLinejoin="round"/>
    {/* Inner circle (delocalized electrons) */}
    <circle cx="50" cy="50" r="20" fill="none" stroke="url(#greenGrad)" strokeWidth="5"/>
    {/* Atom dots at vertices */}
    {[[50,8],[85,28],[85,72],[50,92],[15,72],[15,28]].map(([x,y],i) => (
      <circle key={i} cx={x} cy={y} r="5" fill={i % 2 === 0 ? '#4f8ef7' : '#4ade80'}/>
    ))}
    <defs>
      <linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4f8ef7"/>
        <stop offset="100%" stopColor="#7AADFF"/>
      </linearGradient>
      <linearGradient id="greenGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4ade80"/>
        <stop offset="100%" stopColor="#34d399"/>
      </linearGradient>
    </defs>
  </svg>
)

const EXAMPLE_QUESTIONS = [
  "Is Jardiance covered on FL ValueScript Rx and at what tier?",
  "What are typical PA criteria for GLP-1s under UHC?",
  "My patient is uninsured — is there a PAP for Skyrizi?",
  "What's the cash price for metformin 500mg at CVS?",
  "When did the FDA approve Wegovy?",
]

const SYSTEM_PROMPT = `You are Sanitas Formulary Agent — a pharmacy clinical reference assistant embedded in Sanitas, a formulary reference tool used by clinical pharmacists and healthcare providers at a value-based care practice.

You have access to four health plan formularies:
- FL ValueScript Rx (Florida Blue, 6-tier)
- FL ValueScript SimpleChoice (Florida Blue, 6-tier)
- TX Advantage 3-Tier (UnitedHealthcare Texas)
- TX Essential 4-Tier (UnitedHealthcare Texas)

You can also search the web for current information.

RESPONSE FORMAT — every response must begin with exactly one of these source tags on its own line:
[MEDICATION GUIDES]
[CLINICAL KNOWLEDGE]
[WEB SEARCH]
[MEDICATION GUIDES + WEB SEARCH]
[CLINICAL KNOWLEDGE + WEB SEARCH]

Use [WEB SEARCH] whenever you search the web. Include the source URL and add "Please verify this information at the source."

GUIDELINES:
- Be concise and clinically accurate
- For coverage questions, state the tier and any PA/QL/ST requirements
- For cash pricing, use web search to find current prices
- For PAP programs, search for current manufacturer assistance programs
- Always recommend verifying coverage details directly with the plan
- Never provide patient-specific dosing recommendations
- You are a reference tool for providers, not a prescriber
- The practice does not serve Medicare patients — focus on commercial insurance, Medicaid, and cash-pay`

function SourceBadge({ source }) {
  const configs = {
    'MEDICATION GUIDES':                { bg: 'rgba(79,142,247,0.15)',  color: '#7AADFF', icon: '🗂️' },
    'CLINICAL KNOWLEDGE':               { bg: 'rgba(94,234,212,0.12)',  color: '#5EEAD4', icon: '🧠' },
    'WEB SEARCH':                       { bg: 'rgba(251,191,36,0.12)',  color: '#FBBF24', icon: '🌐' },
    'MEDICATION GUIDES + WEB SEARCH':   { bg: 'rgba(168,85,247,0.12)', color: '#c084fc', icon: '🗂️🌐' },
    'CLINICAL KNOWLEDGE + WEB SEARCH':  { bg: 'rgba(168,85,247,0.12)', color: '#c084fc', icon: '🧠🌐' },
  }
  const cfg = configs[source] || { bg: 'rgba(79,142,247,0.15)', color: '#7AADFF', icon: '📋' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
      background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 4,
      marginBottom: 8, border: `1px solid ${cfg.color}40`,
    }}>
      {cfg.icon} {source}
    </span>
  )
}

function parseResponse(text) {
  const tagMatch = text.match(/^\[([A-Z\s+]+)\]\n?/)
  if (tagMatch) return { source: tagMatch[1].trim(), body: text.slice(tagMatch[0].length).trim() }
  return { source: null, body: text.trim() }
}

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{
          background: 'rgba(79,142,247,0.18)', border: '1px solid rgba(79,142,247,0.3)',
          borderRadius: '12px 12px 2px 12px', padding: '8px 14px',
          fontSize: 13, color: '#e2e8f0', maxWidth: '85%', lineHeight: 1.5,
        }}>
          {msg.content}
        </div>
      </div>
    )
  }
  const { source, body } = parseResponse(msg.content)
  return (
    <div style={{ marginBottom: 14 }}>
      {source && <div><SourceBadge source={source} /></div>}
      <div style={{
        background: '#1a2540', border: '1px solid #263354',
        borderRadius: '2px 12px 12px 12px', padding: '10px 14px',
        fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap',
      }}>
        {body}
      </div>
    </div>
  )
}

export default function ClinicalAgent({ activePlan }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: SYSTEM_PROMPT + `\n\nActive plan: ${activePlan.label} (${activePlan.payer}, ${activePlan.tiers}-tier, effective ${activePlan.effective})`,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: newMessages,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      const textBlock = [...(data.content || [])].reverse().find(b => b.type === 'text')
      const reply = textBlock?.text || '[CLINICAL KNOWLEDGE]\nNo response generated. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      console.error('Agent error:', e)
      setMessages(prev => [...prev, { role: 'assistant', content: `[CLINICAL KNOWLEDGE]\nSorry, something went wrong: ${e.message}. Please try again.` }])
    }
    setLoading(false)
  }

  if (false) {} // placeholder

  return (
    <div style={{
      width: '100%',
      background: '#0d1526',
      border: '1px solid #263354',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px', background: '#1a2540',
        borderBottom: '1px solid #263354', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <BenzeneIcon />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>Sanitas Formulary Agent</span>
        </div>
        <div style={{
          fontSize: 10, color: '#fca5a5', lineHeight: 1.4,
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 4, padding: '4px 8px',
        }}>
          ⚠️ Do not enter patient-identifying information.
        </div>
      </div>

      {/* Messages — only shows when there are messages */}
      {messages.length > 0 && (
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 14px 6px' }}>
          {messages.map((m, i) => <Message key={i} msg={m} />)}
          {loading && (
            <div style={{ display: 'flex', gap: 5, padding: '6px 0', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#475569' }}>Searching</span>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#4f8ef7',
                  animation: `ckbounce 1s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Example questions — only when no messages */}
      {messages.length === 0 && (
        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 7 }}>Try one of these:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {EXAMPLE_QUESTIONS.map((q, i) => (
              <button key={i} onClick={() => send(q)} style={{
                background: '#1a2540', border: '1px solid #263354',
                borderRadius: 7, padding: '6px 10px', cursor: 'pointer',
                fontSize: 11, color: '#94a3b8', textAlign: 'left',
                lineHeight: 1.35, fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f8ef7'; e.currentTarget.style.color = '#e2e8f0' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#263354'; e.currentTarget.style.color = '#94a3b8' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input — always at bottom, no gap */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid #263354',
        flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask a coverage or pricing question..."
          style={{
            flex: 1, background: '#1a2540', border: '1px solid #2e3d65',
            borderRadius: 7, padding: '7px 11px',
            fontSize: 12, color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif', outline: 'none',
          }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{
          background: '#4f8ef7', border: 'none', borderRadius: 7,
          width: 32, height: 32, cursor: 'pointer', color: '#fff',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: (!input.trim() || loading) ? 0.4 : 1, flexShrink: 0,
        }}>↑</button>
      </div>

      <style>{`
        @keyframes ckbounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
