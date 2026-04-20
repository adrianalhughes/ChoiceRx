import { useState, useMemo, useCallback } from 'react'
import bcbsfl from './data/bcbsfl.json'
import simplechoice from './data/simplechoice.json'
import notCovered from './data/not_covered.json'

const PLANS = [
  { id: 'bcbsfl',      label: 'ValueScript Rx',         plan: 'Florida Blue', effective: 'April 2026', data: bcbsfl },
  { id: 'simplechoice',label: 'ValueScript SimpleChoice',plan: 'Florida Blue', effective: 'April 2026', data: simplechoice },
]

const TIER_LABELS = {
  1: 'Preventive',
  2: 'Condition Care Generic',
  3: 'Low-Cost Generic',
  4: 'Condition Care Brand',
  5: 'High-Cost Generic / Preferred Brand',
  6: 'Specialty / Non-Preferred',
}

const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1ZYoF3KZVVOARGSa6zn2IVXfG9Lz31m0qykO37kUndwo/edit?usp=sharing'
const SOURCE_URL = 'https://www.floridablue.com/members/tools-resources/pharmacy/medication-guide'

function highlight(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return <>{text.slice(0, idx)}<mark>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>
}
function drugMatchesQuery(drug, q) { return drug.name.toLowerCase().includes(q) }
function nameMatchesQuery(name, q)  { return name.toLowerCase().includes(q) }

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

function DrugRow({ drug, query, showFlags }) {
  const flags = showFlags ? [drug.pa && 'PA', drug.st && 'ST', drug.ql && 'QL'].filter(Boolean) : []
  return (
    <tr>
      <td className="drug-name">{highlight(drug.name, query)}</td>
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

function DrugSection({ drugs, query, type, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  if (drugs.length === 0) return null
  const isClean = type === 'clean'
  return (
    <div>
      <button className={`section-banner ${isClean ? 'clean-banner' : 'req-banner'} ${open ? 'banner-open' : ''}`}
        onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <ChevronRight className="banner-chevron" />
        <span className="banner-label">{isClean ? 'Open — No Restrictions' : 'Restrictions Apply'}</span>
        <span className="banner-count">{drugs.length}</span>
      </button>
      {open && (
        <table className="drug-table">
          <thead>
            <tr>
              <th>Drug Name</th>
              <th className="center" style={{ width: 48 }}>Tier</th>
              {!isClean && <><th style={{ width: 90 }}>Criteria</th><th>Quantity Limit Detail</th></>}
            </tr>
          </thead>
          <tbody>{drugs.map((d, i) => <DrugRow key={i} drug={d} query={query} showFlags={!isClean} />)}</tbody>
        </table>
      )}
    </div>
  )
}

function ConditionBlock({ condition, query }) {
  const q = query.trim().toLowerCase()
  const filteredClean      = useMemo(() => q ? condition.clean.filter(d => drugMatchesQuery(d, q))      : condition.clean,      [condition.clean, q])
  const filteredRestricted = useMemo(() => q ? condition.restricted.filter(d => drugMatchesQuery(d, q)) : condition.restricted, [condition.restricted, q])
  const totalMatch = filteredClean.length + filteredRestricted.length
  const hasMatch = q && totalMatch > 0
  const noMatch  = q && totalMatch === 0
  const [manualOpen, setManualOpen] = useState(null)
  const open = manualOpen !== null ? manualOpen : (hasMatch || false)
  const handleToggle = useCallback(() => setManualOpen(o => o === null ? !hasMatch : !o), [hasMatch])
  useMemo(() => { setManualOpen(null) }, [q])
  if (noMatch) return null
  const cleanCount = q ? filteredClean.length      : condition.clean.length
  const reqCount   = q ? filteredRestricted.length : condition.restricted.length
  return (
    <div className={`condition-block ${open ? 'open' : ''} ${hasMatch ? 'has-match' : ''}`}>
      <button className="condition-header" onClick={handleToggle} aria-expanded={open}>
        <ChevronRight className="chevron" />
        <span className="condition-name">{condition.condition}</span>
        <div className="condition-meta">
          {cleanCount > 0 && <span className="meta-pill clean">{cleanCount} open</span>}
          {reqCount   > 0 && <span className="meta-pill req">{reqCount} restriction</span>}
        </div>
      </button>
      {open && (
        <div className="condition-body">
          <DrugSection drugs={q ? filteredClean      : condition.clean}      query={q} type="clean"      defaultOpen={true} />
          <DrugSection drugs={q ? filteredRestricted : condition.restricted} query={q} type="restricted" defaultOpen={!!q}   />
        </div>
      )}
    </div>
  )
}

function NonPreferredBlock({ planData, query }) {
  const [open, setOpen] = useState(false)
  const q = query.trim().toLowerCase()
  const tier6 = useMemo(() => {
    const all = planData.flatMap(c => [...c.clean.filter(d => d.tier === 6), ...c.restricted.filter(d => d.tier === 6)])
    const sorted = all.sort((a, b) => a.name.localeCompare(b.name))
    return q ? sorted.filter(d => drugMatchesQuery(d, q)) : sorted
  }, [planData, q])
  const hasMatch = q && tier6.length > 0
  const noMatch  = q && tier6.length === 0
  if (noMatch) return null
  const isOpen = open || hasMatch
  useMemo(() => { if (!q) setOpen(false) }, [q])
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
            Tier 6 = Specialty, Non-Preferred, and High-Cost drugs. Highest patient cost share. PA, ST, and QL restrictions noted where applicable.
          </div>
          <table className="drug-table">
            <thead>
              <tr><th>Drug Name</th><th className="center" style={{width:48}}>Tier</th><th style={{width:90}}>Criteria</th><th>Quantity Limit Detail</th></tr>
            </thead>
            <tbody>{tier6.map((d, i) => <DrugRow key={i} drug={d} query={q} showFlags={true} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NotCoveredBlock({ query }) {
  const [open, setOpen] = useState(false)
  const [showAppendix, setShowAppendix] = useState(false)
  const q = query.trim().toLowerCase()
  const filtered    = useMemo(() => q ? notCovered.main.filter(d => nameMatchesQuery(d, q))     : notCovered.main,     [q])
  const filteredApp = useMemo(() => q ? notCovered.appendix.filter(d => nameMatchesQuery(d, q)) : notCovered.appendix, [q])
  const hasMatch = q && (filtered.length + filteredApp.length) > 0
  const noMatch  = q && filtered.length === 0 && filteredApp.length === 0
  if (noMatch) return null
  const isOpen = open || hasMatch
  useMemo(() => { if (!q) setOpen(false) }, [q])
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
            <tbody>{filtered.map((d, i) => <tr key={i}><td className="drug-name">{highlight(d, q)}</td></tr>)}</tbody>
          </table>
          <button className={`section-banner req-banner ${showAppendix ? 'banner-open' : ''}`}
            onClick={() => setShowAppendix(s => !s)} style={{ marginTop: 1 }}>
            <ChevronRight className="banner-chevron" />
            <span className="banner-label">Appendix A — Excluded Prenatal Vitamins</span>
            <span className="banner-count">{notCovered.appendix.length}</span>
          </button>
          {showAppendix && (
            <table className="drug-table">
              <thead><tr><th>Product Name</th></tr></thead>
              <tbody>{filteredApp.map((d, i) => <tr key={i}><td className="drug-name">{highlight(d, q)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [activePlan, setActivePlan] = useState(PLANS[0])
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const totalMatches = useMemo(() => {
    if (!q) return null
    const fm = activePlan.data.reduce((sum, c) =>
      sum + c.clean.filter(d => drugMatchesQuery(d, q)).length + c.restricted.filter(d => drugMatchesQuery(d, q)).length, 0)
    const nc = notCovered.main.filter(d => nameMatchesQuery(d, q)).length
    return fm + nc
  }, [activePlan.data, q])

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="wordmark">Choice<span>Rx</span></div>
      </header>

      {/* Sub-banner */}
      <div className="sub-banner">
        For reference only.&nbsp;
        <span>Source: <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Florida Blue Medication Guide</a></span>
        &nbsp;·&nbsp;Updated April 2026
      </div>

      {/* Search */}
      <div className="search-wrap">
        <div className="search-inner">
          <SearchIcon className="search-icon" />
          <input className="search-input" type="text" placeholder="Search drug name..."
            value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
          {query && <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>}
        </div>
        {q && (
          <div className="search-count">
            {totalMatches === 0 ? 'No matches found' : `${totalMatches} drug${totalMatches !== 1 ? 's' : ''} matched`}
          </div>
        )}
      </div>

      <main className="main-content">

        {/* Formulary selector */}
        <div className="formulary-selector">
          <span className="formulary-label">Formulary</span>
          <div className="formulary-tabs">
            {PLANS.map(plan => (
              <button key={plan.id} className={`formulary-tab ${activePlan.id === plan.id ? 'active' : ''}`}
                onClick={() => { setActivePlan(plan); setQuery('') }}>
                <span className="tab-name">{plan.label}</span>
                <span className="tab-date">{plan.effective}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Special tiles */}
        <div className="special-grid">
          <NonPreferredBlock planData={activePlan.data} query={query} />
          <NotCoveredBlock query={query} />
        </div>

        {/* Section heading + tier legend */}
        <div className="section-heading">Search Covered Drugs by Condition</div>
        <div className="tier-legend-inline">
          {Object.entries(TIER_LABELS).map(([t, label]) => (
            <span key={t} className="legend-item">
              <span className={`tier-badge tier-${t}`}>{t}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>

        {/* Condition grid */}
        <div className="condition-grid">
          {activePlan.data.map(condition => (
            <ConditionBlock key={condition.condition} condition={condition} query={query} />
          ))}
        </div>

        {q && totalMatches === 0 && (
          <div className="empty-state">
            <p>No drugs matched "<strong>{query}</strong>".</p>
            <p style={{ marginTop: 6, fontSize: 12 }}>Try a partial name or the generic name.</p>
          </div>
        )}

        {/* Resources */}
        <div className="resources-section">
          <div className="resources-label">Resources</div>
          <div className="resources-links">
            <a href={SHEETS_URL} target="_blank" rel="noopener noreferrer" className="resource-link">
              Formulary Spreadsheet (Updated April 2026) <ExtIcon />
            </a>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="resource-link">
              Website: Florida Blue Medication Guides (Current) <ExtIcon />
            </a>
          </div>
        </div>

      </main>

      <footer className="app-footer">
        ChoiceRx · myBlue · {activePlan.label} · {activePlan.effective}
      </footer>
    </>
  )
}
