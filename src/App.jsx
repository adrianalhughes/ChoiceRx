import DiabetesDashboard from './DiabetesDashboard'
import { useState, useMemo } from 'react'
import bcbsfl from './data/bcbsfl.json'
import simplechoice from './data/simplechoice.json'
import notCovered from './data/not_covered.json'

const PLANS = [
  { id: 'bcbsfl',       label: 'ValueScript Rx',          plan: 'Florida Blue', effective: 'April 2026', data: bcbsfl },
  { id: 'simplechoice', label: 'ValueScript SimpleChoice', plan: 'Florida Blue', effective: 'April 2026', data: simplechoice },
]

const TIER_LABELS = {
  1: 'Preventive', 2: 'Condition Care Generic', 3: 'Low-Cost Generic',
  4: 'Condition Care Brand', 5: 'High-Cost Generic / Preferred Brand', 6: 'Specialty / Non-Preferred',
}

const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1ZYoF3KZVVOARGSa6zn2IVXfG9Lz31m0qykO37kUndwo/edit?usp=sharing'
const SOURCE_URL = 'https://www.floridablue.com/members/tools-resources/pharmacy/medication-guide'

// ── Helpers ───────────────────────────────────────────────────────────────────
function highlight(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ChevronRight = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 3 11 8 6 13" />
  </svg>
)
const SearchIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="6.5" cy="6.5" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
  </svg>
)
const ExtIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    style={{width:11,height:11,display:'inline',marginLeft:4,verticalAlign:'middle'}}>
    <path d="M5 2H2v8h8V7M7 2h3v3M10 2L5.5 6.5"/>
  </svg>
)

// ── Drug row ──────────────────────────────────────────────────────────────────
function DrugRow({ drug, q, showFlags }) {
  const flags = showFlags ? [drug.pa && 'PA', drug.st && 'ST', drug.ql && 'QL'].filter(Boolean) : []
  return (
    <tr>
      <td className="drug-name">{highlight(drug.name, q)}</td>
      <td style={{ textAlign: 'center' }}><span className={`tier-badge tier-${drug.tier}`}>{drug.tier}</span></td>
      {showFlags && (
        <>
          <td><div className="flags">{flags.map(f => <span key={f} className={`flag-chip flag-${f}`}>{f}</span>)}</div></td>
          <td>{drug.ql_detail && <span className="ql-detail">{drug.ql_detail}</span>}</td>
        </>
      )}
    </tr>
  )
}

// ── Drug section ──────────────────────────────────────────────────────────────
function DrugSection({ drugs, q, type, startOpen }) {
  if (drugs.length === 0) return null
  const isClean = type === 'clean'
  return (
    <div>
      <button
        className={`section-banner ${isClean ? 'clean-banner' : 'req-banner'} ${startOpen ? 'banner-open' : ''}`}
        aria-expanded={startOpen}
      >
        <ChevronRight className="banner-chevron" />
        <span className="banner-label">{isClean ? 'Open — No Restrictions' : 'Restrictions Apply'}</span>
        <span className="banner-count">{drugs.length}</span>
      </button>
      {isOpen && (
        <table className="drug-table">
          <thead>
            <tr>
              <th>Drug Name</th>
              <th className="center" style={{ width: 48 }}>Tier</th>
              {!isClean && <><th style={{ width: 90 }}>Criteria</th><th>Quantity Limit Detail</th></>}
            </tr>
          </thead>
          <tbody>
            {drugs.map((d, i) => <DrugRow key={i} drug={d} q={q} showFlags={!isClean} />)}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Condition block — receives already-filtered data, never unmounts ──────────
function ConditionBlock({ condition, cleanDrugs, restrictedDrugs, q, visible, hasMatch }) {
  const [open, setOpen] = useState(false)

  // auto-open when search has match; auto-close when search cleared
  const isOpen = hasMatch ? true : open

  if (!visible) return null

  return (
    <div className={`condition-block ${isOpen ? 'open' : ''} ${hasMatch ? 'has-match' : ''}`}>
      <button className="condition-header" onClick={() => setOpen(o => !o)} aria-expanded={isOpen}>
        <ChevronRight className="chevron" />
        <span className="condition-name">{condition.condition}</span>
        <div className="condition-meta">
          {cleanDrugs.length > 0 && <span className="meta-pill clean">{cleanDrugs.length} open</span>}
          {restrictedDrugs.length > 0 && <span className="meta-pill req">{restrictedDrugs.length} restriction</span>}
        </div>
      </button>
      {isOpen && (
        <div className="condition-body">
          <DrugSection drugs={cleanDrugs} q={q} type="clean" startOpen={true} />
          <DrugSection drugs={restrictedDrugs} q={q} type="restricted" startOpen={!!q} />
        </div>
      )}
    </div>
  )
}

// ── Non-Preferred block ───────────────────────────────────────────────────────
function NonPreferredBlock({ tier6, q, hasMatch, visible }) {
  const [open, setOpen] = useState(false)
  const isOpen = hasMatch ? true : open
  if (!visible) return null
  return (
    <div className={`condition-block special-block nonpreferred-block ${isOpen ? 'open' : ''} ${hasMatch ? 'has-match' : ''}`}>
      <button className="condition-header" onClick={() => setOpen(o => !o)} aria-expanded={isOpen}>
        <ChevronRight className="chevron" />
        <span className="condition-name">Non-Preferred Drugs</span>
        <div className="condition-meta"><span className="meta-pill nonpref">{tier6.length} Tier 6</span></div>
      </button>
      {isOpen && (
        <div className="condition-body">
          <div className="special-note nonpref-note">
            Tier 6 = Specialty, Non-Preferred, and High-Cost drugs. Highest patient cost share. PA, ST, and QL restrictions noted.
          </div>
          <table className="drug-table">
            <thead>
              <tr><th>Drug Name</th><th className="center" style={{width:48}}>Tier</th><th style={{width:90}}>Criteria</th><th>Quantity Limit Detail</th></tr>
            </thead>
            <tbody>{tier6.map((d, i) => <DrugRow key={i} drug={d} q={q} showFlags={true} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Not Covered block ─────────────────────────────────────────────────────────
function NotCoveredBlock({ drugs, appendixDrugs, q, hasMatch, visible }) {
  const [open, setOpen] = useState(false)
  const [showAppendix, setShowAppendix] = useState(false)
  const isOpen = hasMatch ? true : open
  if (!visible) return null
  return (
    <div className={`condition-block special-block notcovered-block ${isOpen ? 'open' : ''} ${hasMatch ? 'has-match' : ''}`}>
      <button className="condition-header" onClick={() => setOpen(o => !o)} aria-expanded={isOpen}>
        <ChevronRight className="chevron" />
        <span className="condition-name">Drugs Not Covered</span>
        <div className="condition-meta"><span className="meta-pill notcovered">{notCovered.main.length} drugs</span></div>
      </button>
      {isOpen && (
        <div className="condition-body">
          <div className="special-note notcovered-note">
            These drugs are <strong>not covered</strong>. If a generic of a listed brand exists and is not also listed, the generic IS covered. Effective 4/1/2026.
          </div>
          <table className="drug-table">
            <thead><tr><th>Drug Name</th></tr></thead>
            <tbody>{drugs.map((d, i) => <tr key={i}><td className="drug-name">{highlight(d, q)}</td></tr>)}</tbody>
          </table>
          <button
            className={`section-banner req-banner ${showAppendix ? 'banner-open' : ''}`}
            onClick={() => setShowAppendix(s => !s)}
            style={{ marginTop: 1 }}
          >
            <ChevronRight className="banner-chevron" />
            <span className="banner-label">Appendix A — Excluded Prenatal Vitamins</span>
            <span className="banner-count">{notCovered.appendix.length}</span>
          </button>
          {showAppendix && (
            <table className="drug-table">
              <thead><tr><th>Product Name</th></tr></thead>
              <tbody>{appendixDrugs.map((d, i) => <tr key={i}><td className="drug-name">{highlight(d, q)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activePlan, setActivePlan] = useState(PLANS[0])
  const [showEstimator, setShowEstimator] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()

  // All filtering in one place — no child component ever calls useMemo on search
  const filtered = useMemo(() => {
    const conditions = activePlan.data.map(c => {
      const cleanDrugs      = q ? c.clean.filter(d => d.name.toLowerCase().includes(q))      : c.clean
      const restrictedDrugs = q ? c.restricted.filter(d => d.name.toLowerCase().includes(q)) : c.restricted
      const total = cleanDrugs.length + restrictedDrugs.length
      return { condition: c, cleanDrugs, restrictedDrugs, hasMatch: q ? total > 0 : false, visible: q ? total > 0 : true }
    })

    const allTier6 = activePlan.data.flatMap(c => [
      ...c.clean.filter(d => d.tier === 6),
      ...c.restricted.filter(d => d.tier === 6),
    ]).sort((a, b) => a.name.localeCompare(b.name))
    const tier6 = q ? allTier6.filter(d => d.name.toLowerCase().includes(q)) : allTier6

    const ncDrugs  = q ? notCovered.main.filter(d => d.toLowerCase().includes(q))     : notCovered.main
    const ncAppend = q ? notCovered.appendix.filter(d => d.toLowerCase().includes(q)) : notCovered.appendix

    const totalMatches = conditions.reduce((s, c) => s + c.cleanDrugs.length + c.restrictedDrugs.length, 0)
      + tier6.length + ncDrugs.length

    return { conditions, tier6, ncDrugs, ncAppend, totalMatches,
      tier6HasMatch: q && tier6.length > 0,
      tier6Visible:  q ? tier6.length > 0 : true,
      ncHasMatch:    q && (ncDrugs.length + ncAppend.length) > 0,
      ncVisible:     q ? (ncDrugs.length + ncAppend.length) > 0 : true,
    }
  }, [activePlan.data, q])

  return (
    <>
      <header className="app-header">
        <div className="wordmark">Choice<span>Rx</span></div>
      </header>

      <div className="search-wrap">
        <div className="search-inner">
          <SearchIcon className="search-icon" />
          <input
            className="search-input"
            type="text"
            placeholder="Search drug name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>}
        </div>
        {q && (
          <div className="search-count">
            {filtered.totalMatches === 0
              ? 'No matches found'
              : `${filtered.totalMatches} drug${filtered.totalMatches !== 1 ? 's' : ''} matched`}
          </div>
        )}
      </div>

      <main className="main-content">

        <div className="formulary-selector">
          <span className="formulary-label">Formulary</span>
          <div className="formulary-tabs">
            {PLANS.map(plan => (
              <button key={plan.id}
                className={`formulary-tab ${activePlan.id === plan.id ? 'active' : ''}`}
                onClick={() => { setActivePlan(plan); setQuery('') }}>
                <span className="tab-name">{plan.label}</span>
                <span className="tab-date">{plan.effective}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="source-note">
          For reference only. Source:{' '}
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Florida Blue Medication Guide</a>
          {' '}· Updated April 2026
        </div>

        <div className="special-grid">
          <NonPreferredBlock
            tier6={filtered.tier6} q={q}
            hasMatch={filtered.tier6HasMatch} visible={filtered.tier6Visible}
          />
          <NotCoveredBlock
            drugs={filtered.ncDrugs} appendixDrugs={filtered.ncAppend} q={q}
            hasMatch={filtered.ncHasMatch} visible={filtered.ncVisible}
          />
        </div>

        <div className="section-heading">Search Covered Drugs by Condition</div>
        <div className="tier-legend-inline">
          {Object.entries(TIER_LABELS).map(([t, label]) => (
            <span key={t} className="legend-item">
              <span className={`tier-badge tier-${t}`}>{t}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>

        <div className="condition-grid">
          {filtered.conditions.map(({ condition, cleanDrugs, restrictedDrugs, hasMatch, visible }) => (
            <ConditionBlock
              key={condition.condition}
              condition={condition}
              cleanDrugs={cleanDrugs}
              restrictedDrugs={restrictedDrugs}
              q={q}
              hasMatch={hasMatch}
              visible={visible}
            />
          ))}
        </div>

        {q && filtered.totalMatches === 0 && (
          <div className="empty-state">
            <p>No drugs matched "<strong>{query}</strong>".</p>
            <p style={{ marginTop: 6, fontSize: 12 }}>Try a partial name or the generic name.</p>
          </div>
        )}

        <div className="resources-section">
          <div className="resources-header">
            <div className="resources-label">Resources</div>
            <button className="estimator-btn" onClick={() => setShowEstimator(true)}>
              Impact Estimator <span className="beta-tag">Beta</span>
            </button>
          </div>
          <div className="resources-links">
            <a href={SHEETS_URL} target="_blank" rel="noopener noreferrer" className="resource-link">
              Formulary Spreadsheet (Updated April 2026) <ExtIcon />
            </a>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="resource-link">
              Website: Florida Blue Medication Guides (Current) <ExtIcon />
            </a>
          </div>
        </div>

        {showEstimator && (
          <div className="estimator-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEstimator(false) }}>
            <div className="estimator-modal">
              <button className="estimator-close" onClick={() => setShowEstimator(false)}>✕</button>
              <DiabetesDashboard />
            </div>
          </div>
        )}

      </main>

      <footer className="app-footer">
        ChoiceRx · myBlue · {activePlan.label} · {activePlan.effective}
      </footer>
    </>
  )
}
