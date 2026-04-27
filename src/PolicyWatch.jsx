import { useState, useEffect, useCallback } from 'react'

const BILLS = [
  {
    id: 'help_copays',
    name: 'HELP Copays Act',
    numbers: 'S.864 / H.R.830',
    congress: '119th',
    topic: 'Copay Accumulator Programs',
    summary: 'Prohibits health plans and PBMs from running copay accumulator adjustment programs — requiring all payments, including manufacturer copay assistance, to count toward a patient\'s deductible and out-of-pocket maximum.',
    url: 'https://www.congress.gov/bill/119th-congress/senate-bill/864',
  },
  {
    id: 'pbm_transparency',
    name: 'PBM Price Transparency and Accountability Act',
    numbers: 'S.3345',
    congress: '119th',
    topic: 'PBM Transparency & Reform',
    summary: 'Bipartisan Senate Finance Committee bill (Crapo/Wyden) that delinks PBM compensation from negotiated rebates, bans spread pricing in Medicaid, and increases PBM reporting requirements under Medicare Part D.',
    url: 'https://www.congress.gov/bill/119th-congress/senate-bill/3345',
  },
]

const PROMPT = `You are a clinical pharmacy policy analyst. Provide a concise, current legislative status update for each of the following two federal bills in the 119th Congress. Search for the latest news on each. Be factual and specific — include the most recent action, committee status, and any floor vote or markup news if available. Keep each update to 2–3 sentences. Format your response as valid JSON only, with no markdown or preamble, using this exact structure:

{
  "lastUpdated": "Month DD, YYYY",
  "bills": [
    {
      "id": "help_copays",
      "status": "one-word status like Introduced / In Committee / Passed Senate / Enacted",
      "statusColor": "yellow | green | blue",
      "latestAction": "one sentence describing the most recent congressional action with date",
      "outlook": "one to two sentences on likelihood of passage or next steps"
    },
    {
      "id": "pbm_transparency",
      "status": "one-word status",
      "statusColor": "yellow | green | blue",
      "latestAction": "one sentence describing the most recent congressional action with date",
      "outlook": "one to two sentences on likelihood of passage or next steps"
    }
  ]
}

Bills to research:
1. HELP Copays Act (S.864 / H.R.830) — 119th Congress — prohibits copay accumulator adjustment programs
2. PBM Price Transparency and Accountability Act (S.3345) — 119th Congress — Senate Finance Committee PBM reform bill introduced December 2025 by Crapo and Wyden

Return only valid JSON. No markdown. No explanation.`

function StatusPill({ status, color }) {
  const colorMap = {
    yellow: { bg: 'rgba(234,179,8,0.12)', text: '#ca8a04', border: 'rgba(234,179,8,0.3)' },
    green:  { bg: 'rgba(34,197,94,0.10)', text: '#16a34a', border: 'rgba(34,197,94,0.25)' },
    blue:   { bg: 'rgba(79,142,247,0.12)', text: '#3b82f6', border: 'rgba(79,142,247,0.3)' },
  }
  const c = colorMap[color] || colorMap.yellow
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

function BillCard({ bill, update }) {
  return (
    <div className="policy-card">
      <div className="policy-card-header">
        <div className="policy-card-meta">
          <span className="policy-bill-numbers">{bill.numbers}</span>
          <span className="policy-topic-tag">{bill.topic}</span>
        </div>
        {update && <StatusPill status={update.status} color={update.statusColor} />}
      </div>

      <div className="policy-bill-name">{bill.name}</div>
      <p className="policy-bill-summary">{bill.summary}</p>

      {update && (
        <div className="policy-update-box">
          <div className="policy-update-row">
            <span className="policy-update-label">Latest Action</span>
            <span className="policy-update-text">{update.latestAction}</span>
          </div>
          <div className="policy-update-row">
            <span className="policy-update-label">Outlook</span>
            <span className="policy-update-text">{update.outlook}</span>
          </div>
        </div>
      )}

      <a href={bill.url} target="_blank" rel="noopener noreferrer" className="policy-congress-link">
        View on Congress.gov →
      </a>
    </div>
  )
}

export default function PolicyWatch() {
  const [state, setState] = useState('idle') // idle | loading | done | error
  const [data, setData] = useState(null)
  const [lastFetched, setLastFetched] = useState(null)

  const fetchUpdates = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: PROMPT }],
        }),
      })
      const json = await res.json()
      // Extract the final text block (after any tool use)
      const textBlock = [...json.content].reverse().find(b => b.type === 'text')
      if (!textBlock) throw new Error('No text in response')
      const raw = textBlock.text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(raw)
      setData(parsed)
      setLastFetched(new Date())
      setState('done')
    } catch (e) {
      console.error('PolicyWatch fetch error:', e)
      setState('error')
    }
  }, [])

  return (
    <div className="resources-section policy-watch-section">
      <div className="policy-watch-header">
        <div>
          <div className="resources-label">Rx Policy Tracker</div>
          <div className="policy-watch-sub">AI-powered legislative updates · 119th Congress</div>
        </div>
        <div className="policy-watch-actions">
          {lastFetched && (
            <span className="policy-fetched-at">
              Updated {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="policy-refresh-btn"
            onClick={fetchUpdates}
            disabled={state === 'loading'}
          >
            {state === 'loading' ? (
              <span className="policy-spinner" />
            ) : (
              '↻ Get Latest'
            )}
          </button>
        </div>
      </div>

      {state === 'idle' && (
        <div className="policy-idle-state">
          <p>Track the current legislative status of two active bills affecting drug pricing and patient cost-sharing.</p>
          <button className="policy-load-btn" onClick={fetchUpdates}>
            Load Policy Updates
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="policy-loading-state">
          <span className="policy-spinner large" />
          <span>Searching Congress.gov and recent news…</span>
        </div>
      )}

      {state === 'error' && (
        <div className="policy-error-state">
          Unable to fetch updates. Check your connection and try again.
        </div>
      )}

      {state === 'done' && data && (
        <div className="policy-cards">
          {BILLS.map(bill => (
            <BillCard
              key={bill.id}
              bill={bill}
              update={data.bills?.find(b => b.id === bill.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
