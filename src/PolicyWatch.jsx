import { useState, useCallback } from 'react'

const ITEMS = [
  {
    id: 'help_copays',
    type: 'bill',
    name: 'HELP Copays Act',
    numbers: 'S.864 / H.R.830',
    topic: 'Copay Accumulators',
    summary: "Bans copay accumulator adjustment programs — requires all payments, including manufacturer copay assistance, to count toward a patient's deductible and out-of-pocket maximum. Directly affects specialty and chronic-disease patients whose plans currently drain copay cards without crediting cost-sharing.",
    url: 'https://www.congress.gov/bill/119th-congress/senate-bill/864',
  },
  {
    id: 'pbm_transparency',
    type: 'bill',
    name: 'PBM Price Transparency and Accountability Act',
    numbers: 'S.3345',
    topic: 'PBM Reform',
    summary: 'Bipartisan Senate Finance bill (Crapo/Wyden, Dec 2025) that delinks PBM compensation from negotiated rebates, bans spread pricing in Medicaid, requires any-willing-pharmacy participation, and mandates detailed Part D reporting. The most comprehensive PBM reform bill currently active.',
    url: 'https://www.congress.gov/bill/119th-congress/senate-bill/3345',
  },
  {
    id: 'ira_mfp',
    type: 'rule',
    name: 'IRA Medicare Drug Price Negotiation — Maximum Fair Prices',
    numbers: 'IRA 2022 / CMS Final Rule',
    topic: 'Drug Pricing',
    summary: 'First 10 Part D drugs reached their Maximum Fair Price (MFP) on January 1, 2026 — including Eliquis, Jardiance, Xarelto, and Januvia. CMS is implementing MFPs for 15 additional drugs effective 2027. Multiple manufacturers are challenging constitutionality in active litigation.',
    url: 'https://www.cms.gov/inflation-reduction-act/drug-price-negotiation',
  },
  {
    id: 'mfn_pricing',
    type: 'exec',
    name: 'Most Favored Nation Drug Pricing',
    numbers: 'EO 14273 — Apr 2025',
    topic: 'Executive Action',
    summary: 'EO directing HHS to pursue MFN pricing, setting U.S. prices at the second-lowest price among G7 nations plus Denmark and Switzerland. 16+ major manufacturers signed voluntary MFN agreements. CMS launched the Medicaid GENEROUS Model. Trump called for congressional codification in the 2026 State of the Union.',
    url: 'https://www.whitehouse.gov/presidential-actions/2025/04/delivering-most-favored-nation-prescription-drug-pricing-to-american-patients/',
  },
  {
    id: '340b',
    type: 'rule',
    name: '340B Drug Discount Program — Rebate Model & Contract Pharmacy',
    numbers: 'HRSA / APA Litigation',
    topic: '340B Program',
    summary: "HRSA's voluntary 340B Rebate Model Pilot was struck down by a Maine federal court on Feb 10, 2026 for APA violations — manufacturers must continue providing upfront discounts. HRSA issued an RFI on rebate alternatives (comment deadline April 20, 2026). Parallel contract pharmacy litigation continues across multiple circuits; 13 states enacted protective laws in 2025.",
    url: 'https://www.hrsa.gov/opa',
  },
  {
    id: 'pharma_tariffs',
    type: 'exec',
    name: 'Section 232 Pharmaceutical Tariffs',
    numbers: 'Sec. 232 Trade Act — Apr 2026',
    topic: 'Supply Chain',
    summary: 'On April 2, 2026, President Trump declared pharmaceutical imports a national security risk under Section 232, triggering a plan to impose tariffs on imported drugs and active pharmaceutical ingredients. Near-term risk of drug cost increases and supply volatility, particularly for generics and APIs from India and China.',
    url: 'https://www.federalregister.gov',
  },
]

const TYPE_LABELS = { bill: 'Bill', rule: 'Rule / CMS', exec: 'Executive Action' }
const TYPE_COLORS = {
  bill:  { bg: 'rgba(79,142,247,0.10)', text: '#4f8ef7', border: 'rgba(79,142,247,0.25)' },
  rule:  { bg: 'rgba(168,85,247,0.10)', text: '#a855f7', border: 'rgba(168,85,247,0.25)' },
  exec:  { bg: 'rgba(234,179,8,0.10)',  text: '#ca8a04', border: 'rgba(234,179,8,0.25)'  },
}

const PROMPT = `You are a clinical pharmacy policy analyst. For each of the following 6 federal regulatory items, provide a concise current status update using web search. Be factual and specific — include the most recent action and date where known.

Return ONLY valid JSON with no markdown, no backticks, no preamble. Exactly this structure:

{
  "items": [
    {
      "id": "<id>",
      "status": "<short phrase: In Committee | Enacted | Under Litigation | Active EO | Vacated | Pending>",
      "statusColor": "<yellow | green | blue | red | purple>",
      "latestAction": "<one sentence: most recent action with date>",
      "clinicalImpact": "<one sentence: direct patient or prescriber impact>"
    }
  ]
}

Color guide: green=enacted/signed, blue=passed one chamber, yellow=in committee/introduced, red=blocked/litigation, purple=executive/regulatory.

Research these 6 items:
1. id:"help_copays" — HELP Copays Act S.864/H.R.830, bans copay accumulator programs, 119th Congress
2. id:"pbm_transparency" — S.3345 PBM Price Transparency and Accountability Act, Crapo/Wyden Dec 2025, Senate Finance Committee
3. id:"ira_mfp" — IRA Medicare drug price negotiation, 10 drugs at Maximum Fair Price since Jan 1 2026, 15 more for 2027, manufacturer lawsuits ongoing
4. id:"mfn_pricing" — MFN drug pricing EO 14273 April 2025, voluntary manufacturer deals, Medicaid GENEROUS Model, codification push
5. id:"340b" — 340B Rebate Model Pilot vacated Feb 10 2026, HRSA RFI, contract pharmacy litigation
6. id:"pharma_tariffs" — Section 232 pharmaceutical tariffs proclamation April 2 2026

Return only valid JSON. No explanation.`

function TypePill({ type }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.bill
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap',
    }}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function StatusPill({ status, color }) {
  const colorMap = {
    yellow: { bg: 'rgba(234,179,8,0.12)',   text: '#ca8a04', border: 'rgba(234,179,8,0.3)'   },
    green:  { bg: 'rgba(34,197,94,0.10)',   text: '#16a34a', border: 'rgba(34,197,94,0.25)'  },
    blue:   { bg: 'rgba(79,142,247,0.12)',  text: '#4f8ef7', border: 'rgba(79,142,247,0.3)'  },
    red:    { bg: 'rgba(239,68,68,0.10)',   text: '#dc2626', border: 'rgba(239,68,68,0.25)'  },
    purple: { bg: 'rgba(168,85,247,0.10)',  text: '#a855f7', border: 'rgba(168,85,247,0.25)' },
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

function ItemCard({ item, update }) {
  return (
    <div className="policy-card">
      <div className="policy-card-header">
        <div className="policy-card-meta">
          <TypePill type={item.type} />
          <span className="policy-bill-numbers">{item.numbers}</span>
          <span className="policy-topic-tag">{item.topic}</span>
        </div>
        {update && <StatusPill status={update.status} color={update.statusColor} />}
      </div>
      <div className="policy-bill-name">{item.name}</div>
      <p className="policy-bill-summary">{item.summary}</p>
      {update && (
        <div className="policy-update-box">
          <div className="policy-update-row">
            <span className="policy-update-label">Latest</span>
            <span className="policy-update-text">{update.latestAction}</span>
          </div>
          <div className="policy-update-row">
            <span className="policy-update-label">Clinical Impact</span>
            <span className="policy-update-text">{update.clinicalImpact}</span>
          </div>
        </div>
      )}
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="policy-congress-link">
        Official source →
      </a>
    </div>
  )
}

export default function PolicyWatch() {
  const [state, setState] = useState('idle')
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
          max_tokens: 1500,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: PROMPT }],
        }),
      })
      const json = await res.json()
      const textBlock = [...json.content].reverse().find(b => b.type === 'text')
      if (!textBlock) throw new Error('No text')
      const raw = textBlock.text.replace(/```json|```/g, '').trim()
      setData(JSON.parse(raw))
      setLastFetched(new Date())
      setState('done')
    } catch (e) {
      console.error('PolicyWatch error:', e)
      setState('error')
    }
  }, [])

  return (
    <div className="resources-section policy-watch-section">
      <div className="policy-watch-header">
        <div>
          <div className="resources-label">Rx Policy Tracker</div>
          <div className="policy-watch-sub">Bills · CMS Rules · Executive Actions affecting pharmacy &amp; primary care</div>
        </div>
        <div className="policy-watch-actions">
          {lastFetched && (
            <span className="policy-fetched-at">
              Updated {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="policy-refresh-btn" onClick={fetchUpdates} disabled={state === 'loading'}>
            {state === 'loading' ? <span className="policy-spinner" /> : '↻ Get Latest'}
          </button>
        </div>
      </div>

      {state === 'idle' && (
        <div className="policy-idle-state">
          <p>Track 6 active federal items — legislation, CMS rules, and executive actions — directly affecting drug pricing, formulary design, and patient cost-sharing.</p>
          <button className="policy-load-btn" onClick={fetchUpdates}>Load Policy Updates</button>
        </div>
      )}
      {state === 'loading' && (
        <div className="policy-loading-state">
          <span className="policy-spinner large" />
          <span>Searching for latest legislative and regulatory activity…</span>
        </div>
      )}
      {state === 'error' && (
        <div className="policy-error-state">Unable to fetch updates. Check your connection and try again.</div>
      )}
      {state === 'done' && data && (
        <div className="policy-cards">
          {ITEMS.map(item => (
            <ItemCard key={item.id} item={item} update={data.items?.find(u => u.id === item.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
