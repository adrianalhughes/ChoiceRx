import DiabetesDashboard from './DiabetesDashboard'
import uhcTexas from './data/uhc_texas.json'
import uhcTexasEssential from './data/uhc_texas_essential.json'
import { useState, useMemo } from 'react'
import bcbsfl from './data/bcbsfl.json'
import simplechoice from './data/simplechoice.json'
import notCovered from './data/not_covered.json'

const PLANS = [
  { id: 'bcbsfl',              label: 'ValueScript Rx',          plan: 'Florida Blue',     payer: 'Florida Blue',     effective: 'April 2026', tiers: 6, data: bcbsfl },
  { id: 'simplechoice',        label: 'ValueScript SimpleChoice', plan: 'Florida Blue',     payer: 'Florida Blue',     effective: 'April 2026', tiers: 6, data: simplechoice },
  { id: 'uhc_texas',           label: 'Texas Advantage 3-Tier',   plan: 'UnitedHealthcare', payer: 'UnitedHealthcare', effective: 'May 2026',   tiers: 3, data: uhcTexas },
  { id: 'uhc_texas_essential', label: 'Texas Essential 4-Tier',   plan: 'UnitedHealthcare', payer: 'UnitedHealthcare', effective: 'May 2026',   tiers: 4, data: uhcTexasEssential },
]

const TIER_LABELS_4 = {
  1: 'Lower-Cost (Generic)',
  2: 'Mid-Range Cost',
  3: 'Mid-Range (Brand)',
  4: 'Highest-Cost (Brand)',
}

const TIER_LABELS_6 = {
  1: 'Preventive', 2: 'Condition Care Generic', 3: 'Low-Cost Generic',
  4: 'Condition Care Brand', 5: 'High-Cost Generic / Preferred Brand', 6: 'Specialty / Non-Preferred',
}

const TIER_LABELS_3 = {
  1: 'Lower-Cost (Generic)',
  2: 'Mid-Range Cost',
  3: 'Highest-Cost (Brand)',
}

const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1ZYoF3KZVVOARGSa6zn2IVXfG9Lz31m0qykO37kUndwo/edit?usp=sharing'
const SOURCE_URL = 'https://www.floridablue.com/members/tools-resources/pharmacy/medication-guide'

function highlight(text, query) {
  if (!query) return text
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

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

function ConditionBlock({ name, cleanDrugs, restrictedDrugs, q, forceOpen }) {
  const [open, setOpen] = useState(false)
  const isOpen = forceOpen || open
  const total = cleanDrugs.length + restrictedDrugs.length
  if (total === 0) return null

  return (
    <div className={`condition-block ${isOpen ? 'open' : ''} ${forceOpen ? 'has-match' : ''}`}>
      <button className="condition-header" onClick={() => setOpen(o => !o)} aria-expanded={isOpen}>
        <ChevronRight className="chevron" />
        <span className="condition-name">{name}</span>
        <div className="condition-meta">
          {cleanDrugs.length > 0 && <span className="meta-pill clean">{cleanDrugs.length} open</span>}
          {restrictedDrugs.length > 0 && <span className="meta-pill req">{restrictedDrugs.length} restriction</span>}
        </div>
      </button>

      {isOpen && (
        <div className="condition-body">
          {cleanDrugs.length > 0 && (
            <>
              <div className="section-banner clean-banner banner-open" style={{pointerEvents:'none'}}>
                <ChevronRight className="banner-chevron" />
                <span className="banner-label">Open — No Restrictions</span>
                <span className="banner-count">{cleanDrugs.length}</span>
              </div>
              <table className="drug-table">
                <thead><tr>
                  <th>Drug Name</th>
                  <th className="center" style={{width:48}}>Tier</th>
                </tr></thead>
                <tbody>{cleanDrugs.map((d,i) => <DrugRow key={i} drug={d} q={q} showFlags={false} />)}</tbody>
              </table>
            </>
          )}
          {restrictedDrugs.length > 0 && (
            <>
              <div className="section-banner req-banner banner-open" style={{pointerEvents:'none'}}>
                <ChevronRight className="banner-chevron" />
                <span className="banner-label">Restrictions Apply</span>
                <span className="banner-count">{restrictedDrugs.length}</span>
              </div>
              <table className="drug-table">
                <thead><tr>
                  <th>Drug Name</th>
                  <th className="center" style={{width:48}}>Tier</th>
                  <th style={{width:90}}>Criteria</th>
                  <th>Quantity Limit Detail</th>
                </tr></thead>
                <tbody>{restrictedDrugs.map((d,i) => <DrugRow key={i} drug={d} q={q} showFlags={true} />)}</tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function NonPreferredBlock({ drugs, q }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`condition-block special-block nonpreferred-block ${open ? 'open' : ''}`}>
      <button className="condition-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <ChevronRight className="chevron" />
        <span className="condition-name">Non-Preferred Drugs</span>
        <div className="condition-meta"><span className="meta-pill nonpref">{drugs.length} Tier 6</span></div>
      </button>
      {open && (
        <div className="condition-body">
          <div className="special-note nonpref-note">
            Tier 6 = Specialty, Non-Preferred, and High-Cost drugs. Highest patient cost share.
          </div>
          <table className="drug-table">
            <thead><tr>
              <th>Drug Name</th>
              <th className="center" style={{width:48}}>Tier</th>
              <th style={{width:90}}>Criteria</th>
              <th>Quantity Limit Detail</th>
            </tr></thead>
            <tbody>{drugs.map((d,i) => <DrugRow key={i} drug={d} q={q} showFlags={true} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NotCoveredBlock({ drugs, appendixDrugs, q }) {
  const [open, setOpen] = useState(false)
  const [showAppendix, setShowAppendix] = useState(false)
  return (
    <div className={`condition-block special-block notcovered-block ${open ? 'open' : ''}`}>
      <button className="condition-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <ChevronRight className="chevron" />
        <span className="condition-name">Drugs Not Covered</span>
        <div className="condition-meta"><span className="meta-pill notcovered">{notCovered.main.length} drugs</span></div>
      </button>
      {open && (
        <div className="condition-body">
          <div className="special-note notcovered-note">
            These drugs are <strong>not covered</strong>. If a generic of a listed brand exists and is not also listed, the generic IS covered. Effective 4/1/2026.
          </div>
          <table className="drug-table">
            <thead><tr><th>Drug Name</th></tr></thead>
            <tbody>{drugs.map((d,i) => <tr key={i}><td className="drug-name">{highlight(d, q)}</td></tr>)}</tbody>
          </table>
          <button className={`section-banner req-banner ${showAppendix ? 'banner-open' : ''}`} onClick={() => setShowAppendix(s => !s)} style={{marginTop:1}}>
            <ChevronRight className="banner-chevron" />
            <span className="banner-label">Appendix A — Excluded Prenatal Vitamins</span>
            <span className="banner-count">{notCovered.appendix.length}</span>
          </button>
          {showAppendix && (
            <table className="drug-table">
              <thead><tr><th>Product Name</th></tr></thead>
              <tbody>{appendixDrugs.map((d,i) => <tr key={i}><td className="drug-name">{highlight(d, q)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [activePlan, setActivePlan] = useState(PLANS[0])
  const [showEstimator, setShowEstimator] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    const conditions = activePlan.data.map(c => ({
      name: c.condition,
      cleanDrugs:      q ? c.clean.filter(d => d.name.toLowerCase().includes(q))      : c.clean,
      restrictedDrugs: q ? c.restricted.filter(d => d.name.toLowerCase().includes(q)) : c.restricted,
      forceOpen: q ? (
        c.clean.some(d => d.name.toLowerCase().includes(q)) ||
        c.restricted.some(d => d.name.toLowerCase().includes(q))
      ) : false,
    }))

    const allTier6 = activePlan.data
      .flatMap(c => [...c.clean.filter(d => d.tier === 6), ...c.restricted.filter(d => d.tier === 6)])
      .sort((a, b) => a.name.localeCompare(b.name))

    const ncDrugs  = q ? notCovered.main.filter(d => d.toLowerCase().includes(q))     : notCovered.main
    const ncAppend = q ? notCovered.appendix.filter(d => d.toLowerCase().includes(q)) : notCovered.appendix

    const totalMatches = conditions.reduce((s, c) => s + c.cleanDrugs.length + c.restrictedDrugs.length, 0)
      + ncDrugs.length

    return { conditions, tier6: allTier6, ncDrugs, ncAppend, totalMatches }
  }, [activePlan.data, q])

  return (
    <>
      <header className="app-header">
        <div className="wordmark">Choice<span>Rx</span></div>
      </header>

      <div className="plan-bar">
        <div className="plan-bar-inner">
          <span className="formulary-label">Formulary</span>
          <div className="formulary-tabs">
            {PLANS.map(plan => (
              <button key={plan.id}
                className={`formulary-tab ${activePlan.id === plan.id ? 'active' : ''} ${plan.payer === 'UnitedHealthcare' ? 'uhc-tab' : ''}`}
                onClick={() => { setActivePlan(plan); setQuery('') }}>
                <span className="tab-plan">{plan.payer === 'UnitedHealthcare' ? 'UnitedHealthcare' : 'myBlue'}</span>
                <span className="tab-name">{plan.label}</span>
                <span className="tab-date">{plan.effective}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

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

        <div className="source-note">
          For reference only. Source:{' '}
          {activePlan.payer === 'UnitedHealthcare'
            ? <a href="https://www.uhc.com/health-and-wellness/drug-list" target="_blank" rel="noopener noreferrer">UnitedHealthcare Drug List</a>
            : <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Florida Blue Medication Guide</a>
          }
          {' '}· Updated {activePlan.effective}
        </div>

        <div className="special-grid">
          <NonPreferredBlock drugs={filtered.tier6} q={q} />
          <NotCoveredBlock drugs={filtered.ncDrugs} appendixDrugs={filtered.ncAppend} q={q} />
        </div>

        <div className="section-heading">Search Covered Drugs by Condition</div>
        <div className="tier-legend-inline">
          {Object.entries(activePlan.tiers === 3 ? TIER_LABELS_3 : activePlan.tiers === 4 ? TIER_LABELS_4 : TIER_LABELS_6).map(([t, label]) => (
            <span key={t} className="legend-item">
              <span className={`tier-badge tier-${t}`}>{t}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>

        <div className="condition-grid">
          {filtered.conditions.map(c => (
            <ConditionBlock
              key={c.name}
              name={c.name}
              cleanDrugs={c.cleanDrugs}
              restrictedDrugs={c.restrictedDrugs}
              q={q}
              forceOpen={c.forceOpen}
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
          <div className="resources-label">Resources</div>
          <div className="resources-links">
            <a href={SHEETS_URL} target="_blank" rel="noopener noreferrer" className="resource-link">
              Formulary Spreadsheet (Updated April 2026) <ExtIcon />
            </a>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="resource-link">
              Website: Florida Blue Medication Guides (Current) <ExtIcon />
            </a>
            <button className="resource-link estimator-btn" onClick={() => setShowEstimator(true)}>
              Impact Estimator <span className="beta-tag">Beta</span>
            </button>
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
        ChoiceRx · {activePlan.payer} · {activePlan.label} · {activePlan.effective}
      </footer>
    </>
  )
}
