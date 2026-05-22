import { useState, useRef, useEffect } from 'react'
import notCoveredData from './data/not_covered.json'
import {
  normalizeDrugName,
  getLeadingBrandCandidate,
  matchesBrandName,
  lookupStepTherapyForDrug,
  lookupStepTherapyForQuery,
} from './formularyHelpers'

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

const EXAMPLE_QUESTIONS = [
  'What are the coverage criteria for Ozempic?',
  'How do I sign up for medication delivery?',
  "Why wasn't Jardiance covered?",
]

const NOT_FOUND = 'Answer cannot be found.'

const TIER_LABELS_4 = {
  1: 'Lower-Cost (Generic)',
  2: 'Mid-Range Cost',
  3: 'Mid-Range (Brand)',
  4: 'Highest-Cost (Brand)',
}

const TIER_LABELS_6 = {
  1: 'Preventive',
  2: 'Condition Care Generic',
  3: 'Low-Cost Generic',
  4: 'Condition Care Brand',
  5: 'High-Cost Generic / Preferred Brand',
  6: 'Specialty / Non-Preferred',
}

const TIER_LABELS_3 = {
  1: 'Lower-Cost (Generic)',
  2: 'Mid-Range Cost',
  3: 'Highest-Cost (Brand)',
}

const STOP_WORDS = new Set([
  'what', 'are', 'the', 'is', 'it', 'for', 'a', 'an', 'on', 'at', 'to', 'of', 'and', 'or', 'do', 'i', 'you', 'can', 'how', 'why', 'was', 'were', 'been',
  'not', 'no', 'my', 'me', 'if', 'wasnt', "wasn't", 'isnt', "isn't", 'covered', 'coverage', 'criteria', 'tell', 'about', 'sign', 'up', 'get', 'need',
  'does', 'did', 'will', 'would', 'could', 'should', 'may', 'when', 'where', 'there', 'this', 'that', 'with', 'without', 'any', 'some', 'prior',
  'authorization', 'auth', 'cost', 'price', 'tier', 'formulary', 'please', 'help', 'explain', 'describe', 'medication', 'delivery', 'pharmacy',
  'mail', 'order', 'patient', 'person', 'list', 'give', 'show', 'find', 'search', 'look', 'into', 'from', 'by', 'be', 'as', 'we', 'our', 'your',
  'their', 'they', 'them', 'his', 'her', 'she', 'he', 'who', 'which', 'than', 'then', 'too', 'also', 'just', 'only', 'even', 'still', 'such',
])

const DELIVERY_RESOURCE_LINES = [
  'Sav-Rx — spreadsheet of medications available at participating Sanitas dispensing locations: https://docs.google.com/spreadsheets/d/1FvY54ZzkuLdAmFtbs4lZI42Pcd5z-Q4b/edit?usp=sharing&ouid=105603016175522070259&rtpof=true&sd=true',
  'Cost Plus Drugs — transparent mail-order pricing: https://costplusdrugs.com',
]

function tierLabelFor(activePlan, tier) {
  const labels = activePlan.tiers === 3 ? TIER_LABELS_3 : activePlan.tiers === 4 ? TIER_LABELS_4 : TIER_LABELS_6
  return labels[tier] || ''
}

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function extractSearchPhrase(raw) {
  const lower = raw.toLowerCase().replace(/[''?!.,]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = lower.split(' ').filter(w => w.length > 0 && !STOP_WORDS.has(w))
  return words.join(' ')
}

function collectDrugs(planData) {
  const out = []
  for (const cat of planData) {
    for (const drug of cat.clean) out.push({ drug, condition: cat.condition })
    for (const drug of cat.restricted) out.push({ drug, condition: cat.condition })
  }
  return out
}

function scoreDrugName(drugName, termNorm) {
  if (!termNorm || termNorm.length < 2) return 0
  const n = normalizeDrugName(drugName)
  if (n === termNorm) return 1200
  if (n.includes(termNorm) || termNorm.includes(n)) return 950

  const words = termNorm.split(' ').filter(w => w.length >= 3)
  let wscore = 0
  for (const w of words) {
    if (n.includes(w)) wscore += 140
  }

  if (matchesBrandName(drugName, termNorm)) return 900

  const brand = getLeadingBrandCandidate(drugName)
  if (brand) {
    const bn = normalizeDrugName(brand)
    if (bn === termNorm) return 1100
    if (bn.includes(termNorm) || termNorm.includes(bn)) return 880
    if (termNorm.length >= 4 && bn.length >= 4 && Math.abs(bn.length - termNorm.length) <= 6) {
      const dist = levenshtein(bn, termNorm)
      if (dist <= 2) return 820 - dist * 40
    }
  }

  const paren = drugName.match(/\(([^)]+)\)/)
  if (paren) {
    const inner = normalizeDrugName(paren[1])
    if (inner.includes(termNorm) || termNorm.includes(inner)) return 860
    if (words.some(w => inner.includes(w))) wscore += 80
  }

  return wscore
}

function findBestDrug(termNorm, planData) {
  if (!termNorm) return null
  let best = null
  let bestScore = 0
  for (const { drug } of collectDrugs(planData)) {
    const s = scoreDrugName(drug.name, termNorm)
    if (s > bestScore) {
      bestScore = s
      best = drug
    }
  }
  if (bestScore < 120) return null
  return { drug: best, score: bestScore }
}

function findNotCoveredMatch(termNorm) {
  if (!termNorm) return null
  const all = [...notCoveredData.main, ...notCoveredData.appendix]
  let best = null
  let bestScore = 0
  for (const entry of all) {
    const s = scoreDrugName(entry, termNorm)
    if (s > bestScore) {
      bestScore = s
      best = entry
    }
  }
  if (bestScore < 120) return null
  return { name: best, score: bestScore }
}

function detectIntent(q) {
  const lower = q.toLowerCase()
  return {
    wantsDelivery:
      /delivery|mail\s*(order|pharmacy)|sign\s*up|dispens(ing)?|ship(ping)?|home\s*delivery|local\s*pharmacy\s*pickup/i.test(lower),
    wantsCriteria:
      /\bcriteria\b|\bcoverage\b|\bcovered\b|cover\b|utilization|step\s*therapy|\bst\b|quantity|\bql\b|limit|limits|requirement/i.test(lower),
    wantsTierCost:
      /\btier\b|\bcost\b|\bprice\b|\bcopay\b|\bpremium\b|what\s+does\s+it\s+cost|how\s+much/i.test(lower),
    wantsPA: /\bprior\s*auth|\bpa\b|prior\s*authorization/i.test(lower),
    wantsFormulary: /\bon\s+formulary\b|\bformulary\b|is\s+it\s+covered/i.test(lower),
    negativeCoverage:
      /\bwhy\s+(wasn'?t|was\s+not|isn'?t|is\s+not)\b|\bnot\s+covered\b|\bwasn'?t\s+covered\b|\bisn'?t\s+covered\b|\bdenied\b|\brejected\b/i.test(
        lower,
      ),
  }
}

function wantsDeliveryOnly(q, termNorm, drugMatchScore) {
  const intent = detectIntent(q)
  if (!intent.wantsDelivery) return false
  if (drugMatchScore >= 400) return false
  return true
}

function displayDrugLabel(drug) {
  const brand = getLeadingBrandCandidate(drug.name)
  if (brand) return brand.charAt(0) + brand.slice(1).toLowerCase()
  const short = drug.name.split(',')[0].trim()
  return short.length > 48 ? `${short.slice(0, 45)}…` : short
}

function formatQlLine(drug) {
  if (!drug.ql || !drug.ql_detail) return null
  return drug.ql_detail.replace(/\//g, ' per ')
}

function shortenStLine(s, maxLen) {
  const t = s.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1)}…`
}

function buildDrugAnswer(activePlan, drug, intent, falsePremiseNegative) {
  const planName = activePlan.label
  const tier = drug.tier
  const tLab = tierLabelFor(activePlan, tier)
  const label = displayDrugLabel(drug)
  const ql = formatQlLine(drug)
  const pa = drug.pa === true
  const stFlag = drug.st === true
  const stLines = lookupStepTherapyForDrug(drug.name)

  const parts = []

  if (falsePremiseNegative) {
    parts.push(
      `${label} is listed on ${planName} — it is covered as tier ${tier}${tLab ? ` (${tLab})` : ''}. A claim may still reject for documentation, pharmacy network, or benefit configuration even when the drug is on the formulary.`,
    )
  } else {
    parts.push(`${label} on ${planName} is covered as tier ${tier}${tLab ? ` (${tLab})` : ''}.`)
  }

  const tierCostOnly =
    intent.wantsTierCost &&
    !intent.wantsCriteria &&
    !intent.wantsPA &&
    !intent.wantsFormulary &&
    !intent.negativeCoverage

  if (tierCostOnly) {
    if (ql) parts.push(`Quantity limits: ${ql}.`)
    parts.push('Copays and lowest net cost depend on benefit design; use the tier as a relative cost guide.')
    return parts.join(' ')
  }

  if (pa) parts.push('Prior authorization is required.')
  if (ql) parts.push(`Quantity limits: ${ql}.`)
  if (stFlag && stLines?.length) {
    const shown = stLines.slice(0, 3).map(l => shortenStLine(l, 220))
    parts.push(`Step therapy (condensed): ${shown.join(' ')}`)
  }

  return parts.join(' ')
}

function buildStepTherapyOnlyAnswer(activePlan, phraseNorm) {
  const lines = lookupStepTherapyForQuery(phraseNorm)
  if (!lines?.length) return null
  const preview = lines.slice(0, 3).map(l => shortenStLine(l, 280))
  return `Step therapy criteria for ${activePlan.label} include the following excerpt from loaded responsible-steps data (verify against the official PDF if needed): ${preview.join(' ')}`
}

function buildDeliveryAnswer() {
  return [
    'Medication access options referenced in this app include:',
    ...DELIVERY_RESOURCE_LINES.map((line, i) => `${i + 1}. ${line}`),
    'Coordinate signup or enrollment directly through those programs; coverage under your pharmacy benefit still follows formulary rules.',
  ].join('\n\n')
}

function answerFormularyQuestion(rawQuery, activePlan) {
  const phrase = extractSearchPhrase(rawQuery)
  const phraseNorm = normalizeDrugName(phrase)
  const intent = detectIntent(rawQuery)
  let drugMatch = findBestDrug(phraseNorm, activePlan.data)
  if (!drugMatch && phraseNorm.length >= 4) {
    const skipFallback = new Set(['delivery', 'medication', 'pharmacy', 'mail', 'order', 'signing', 'signup'])
    const words = phraseNorm.split(' ').filter(w => w.length >= 4 && !skipFallback.has(w))
    for (const w of words) {
      const m = findBestDrug(w, activePlan.data)
      if (m && (!drugMatch || m.score > drugMatch.score)) drugMatch = m
    }
  }

  if (wantsDeliveryOnly(rawQuery, phraseNorm, drugMatch?.score ?? 0)) return buildDeliveryAnswer()

  const nc = findNotCoveredMatch(phraseNorm)
  if (drugMatch && nc && nc.score > drugMatch.score + 80) drugMatch = null

  if (!drugMatch && nc) {
    return `${nc.name} appears on the imported not-covered exclusion list used by this reference — it is not treated as a covered formulary item in this dataset. Confirm with the plan for member-specific benefits.`
  }

  if (drugMatch) {
    const falseNeg = intent.negativeCoverage && drugMatch.drug.tier >= 1 && drugMatch.drug.tier <= 6
    return buildDrugAnswer(activePlan, drugMatch.drug, intent, falseNeg)
  }

  const stOnly = buildStepTherapyOnlyAnswer(activePlan, phraseNorm || normalizeDrugName(rawQuery))
  if (stOnly) return stOnly
  if (intent.wantsDelivery) return buildDeliveryAnswer()
  return NOT_FOUND
}

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="fa-msg-user-wrap">
        <div className="fa-msg-user">{msg.content}</div>
      </div>
    )
  }
  return <div className="fa-msg-assistant">{msg.content}</div>
}

export default function FormularyAssistant({ activePlan }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    setMessages([])
  }, [activePlan.id])

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = text => {
    const userText = (text ?? input).trim()
    if (!userText) return
    setInput('')
    const reply = answerFormularyQuestion(userText, activePlan)
    setMessages(prev => [...prev, { role: 'user', content: userText }, { role: 'assistant', content: reply }])
  }

  const onExampleClick = q => {
    setInput(q)
    setTimeout(() => send(q), 60)
  }

  return (
    <>
      <div
        className={`fa-overlay${open ? ' visible' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <div className={`fa-slide-panel${open ? ' open' : ''}`} role="dialog" aria-label="Formulary Assistant">
        <div className="fa-panel-header">
          <div className="fa-panel-header-top">
            <span className="fa-panel-title">Formulary Assistant</span>
            <button type="button" className="fa-panel-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="fa-panel-subtitle">Searches your plan data locally</div>
          <div className="fa-panel-subtitle-muted">Information is never sent to an external server</div>
        </div>

        <div className="fa-panel-body">
          {messages.length > 0 && (
            <button type="button" className="fa-reset" onClick={() => setMessages([])}>
              ← New question
            </button>
          )}
          {messages.length === 0 && (
            <>
              <div className="fa-examples-label">Try one of these:</div>
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <button key={i} type="button" className="fa-example-btn" onClick={() => onExampleClick(q)}>
                  {q}
                </button>
              ))}
            </>
          )}
          {messages.map((m, i) => (
            <Message key={i} msg={m} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="fa-panel-input-row">
          <input
            className="fa-panel-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            aria-label="Message to formulary assistant"
          />
          <button type="button" className="fa-panel-send" onClick={() => send()} disabled={!input.trim()}>
            ↑
          </button>
        </div>
      </div>

      <div className="fa-fab-wrap">
        <button
          type="button"
          className="fa-fab"
          onClick={() => setOpen(o => !o)}
          aria-label="Formulary Assistant"
        >
          <ChatIcon />
        </button>
      </div>
    </>
  )
}
