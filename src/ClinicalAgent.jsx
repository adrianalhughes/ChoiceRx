import { useState, useRef, useEffect } from 'react'

const EXAMPLE_QUESTIONS = [
  "Is Jardiance covered on FL ValueScript Rx and at what tier?",
  "My patient is uninsured — is there a PAP program for Skyrizi?",
  "What are typical PA criteria for GLP-1s under UHC?",
  "What's the cash price for metformin 500mg at CVS?",
  "When did the FDA approve Wegovy?",
  "Is Humira on the specialty list for Florida Blue?",
]

const SYSTEM_PROMPT = `You are Claude's Clinical Knowledge — a pharmacy clinical reference assistant embedded in Sanitas, a formulary reference tool used by clinical pharmacists and healthcare providers at a value-based care practice.

You have access to four health plan formularies:
- FL ValueScript Rx (Florida Blue, 6-tier)
- FL ValueScript SimpleChoice (Florida Blue, 6-tier)
- TX Advantage 3-Tier (UnitedHealthcare Texas)
- TX Essential 4-Tier (UnitedHealthcare Texas)

You can also search the web for current information.

RESPONSE FORMAT — every response must begin with a source tag on its own line:
- [MEDICATION GUIDES] — when answering from the formulary data provided
- [CLINICAL KNOWLEDGE] — when drawing from general clinical/pharmacology training
- [WEB SEARCH] — when you searched the web; include the source URL and note "Please verify this information at the source."
You may combine tags if multiple sources were used, e.g. [MEDICATION GUIDES + WEB SEARCH]

GUIDELINES:
- Be concise and clinically accurate
- For coverage questions, state the tier, any PA/QL/ST requirements
- For cash pricing, use web search to find current prices
- For PAP programs, search for current manufacturer assistance programs
- Always recommend verifying coverage details directly with the plan
- Never provide patient-specific dosing recommendations
- You are a reference tool for providers, not a prescriber
- Flag anything that should be double-checked with the plan or manufacturer

The practice does not serve Medicare patients — focus on commercial insurance, Medicaid, and cash-pay scenarios.`

function SourceBadge({ source }) {
  const configs = {
    'MEDICATION GUIDES':           { bg: 'rgba(79,142,247,0.15)',   color: '#7AADFF', icon: '🗂️' },
    'CLINICAL KNOWLEDGE':          { bg: 'rgba(94,234,212,0.12)',   color: '#5EEAD4', icon: '🧠' },
    'WEB SEARCH':                  { bg: 'rgba(251,191,36,0.12)',   color: '#FBBF24', icon: '🌐' },
    'MEDICATION GUIDES + WEB SEARCH': { bg: 'rgba(168,85,247,0.12)', color: '#c084fc', icon: '🗂️🌐' },
    'CLINICAL KNOWLEDGE + WEB SEARCH': { bg: 'rgba(168,85,247,0.12)', color: '#c084fc', icon: '🧠🌐' },
  }
  const cfg = configs[source] || { bg: 'rgba(79,142,247,0.15)', color: '#7AADFF', icon: '📋' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
      background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: 4,
      marginBottom: 8, border: `1px solid ${cfg.color}30`
    }}>
      {cfg.icon} {source}
    </span>
  )
}

function parseResponse(text) {
  const tagMatch = text.match(/^\[([A-Z\s+]+)\]\n?/)
  if (tagMatch) {
    return { source: tagMatch[1].trim(), body: text.slice(tagMatch[0].length).trim() }
  }
  return { source: null, body: text.trim() }
}

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{
          background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.25)',
          borderRadius: '12px 12px 2px 12px', padding: '8px 14px',
          fontSize: 13, color: '#e2e8f0', maxWidth: '85%', lineHeight: 1.5
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
        fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, maxWidth: '95%',
        whiteSpace: 'pre-wrap'
      }}>
        {body}
      </div>
    </div>
  )
}

export default function ClinicalAgent({ activePlan }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const send = async (text) => {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT + `\n\nActive plan: ${activePlan.label} (${activePlan.payer}, ${activePlan.tiers}-tier, effective ${activePlan.effective})`,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const textBlock = [...data.content].reverse().find(b => b.type === 'text')
      const reply = textBlock?.text || 'Sorry, I could not generate a response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '[CLINICAL KNOWLEDGE]\nSorry, something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Chat trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 400,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#4f8ef7' : '#1a2540',
          border: '2px solid #4f8ef7',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 20px rgba(79,142,247,0.4)',
          transition: 'all 0.2s',
        }}
        title="Claude's Clinical Knowledge"
      >
        {open ? '✕' : '🧬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 400,
          width: 420, height: 560,
          background: '#0d1526', border: '1px solid #263354',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px 12px', background: '#1a2540',
            borderBottom: '1px solid #263354', flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
              🧬 Claude's Clinical Knowledge
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Active plan: {activePlan.label} · Ask anything about coverage, pricing, or PA
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}>
            {messages.length === 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 12, lineHeight: 1.5 }}>
                  Ask a clinical or formulary question, or try one of these:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {EXAMPLE_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => send(q)} style={{
                      background: '#1a2540', border: '1px solid #263354',
                      borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                      fontSize: 11, color: '#94a3b8', textAlign: 'left',
                      lineHeight: 1.4, fontFamily: 'DM Sans, sans-serif',
                      transition: 'border-color 0.15s, color 0.15s',
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
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {loading && (
              <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#4f8ef7',
                    animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #263354', flexShrink: 0, display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask a coverage or pricing question..."
              style={{
                flex: 1, background: '#1a2540', border: '1px solid #2e3d65',
                borderRadius: 8, padding: '8px 12px',
                fontSize: 12, color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif',
                outline: 'none',
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} style={{
              background: '#4f8ef7', border: 'none', borderRadius: 8,
              width: 36, height: 36, cursor: 'pointer', color: '#fff',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: (!input.trim() || loading) ? 0.4 : 1,
            }}>↑</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
