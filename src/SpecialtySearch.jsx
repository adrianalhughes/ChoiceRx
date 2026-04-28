import { useState, useMemo } from 'react'
import specialtySelf from './data/specialty_self.json'
import specialtyProv from './data/specialty_prov.json'

const SELF_COVERED = specialtySelf.covered
const SELF_NC      = specialtySelf.not_covered
const PROV_COVERED = specialtyProv.covered

function FlagChip({ label, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
      padding: '2px 5px', borderRadius: 3, marginLeft: 5,
      background: color + '1a', color, border: `1px solid ${color}40`,
    }}>{label}</span>
  )
}

function DrugResult({ drug }) {
  return (
    <div className="spec-result">
      <span className="spec-drug-name">{drug.name}</span>
      {drug.ldd        && <FlagChip label="LDD" color="#f59e0b" />}
      {drug.pa         && <FlagChip label="PA"  color="#4f8ef7" />}
      {drug.ql         && <FlagChip label="QL"  color="#a855f7" />}
      {drug.dual_route && <FlagChip label="Self or Provider-Admin" color="#10b981" />}
    </div>
  )
}

export default function SpecialtySearch() {
  const [tab, setTab]   = useState('self')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const { results, isNc } = useMemo(() => {
    if (!q || q.length < 2) return { results: [], isNc: false }
    const list = tab === 'self' ? SELF_COVERED : PROV_COVERED
    const res  = list.filter(d => d.name.toLowerCase().includes(q)).slice(0, 30)
    const nc   = tab === 'self' && res.length === 0 &&
                 SELF_NC.some(d => d.name.toLowerCase().includes(q))
    return { results: res, isNc: nc }
  }, [q, tab])

  const notFound = q.length >= 2 && results.length === 0 && !isNc

  return (
    <div className="resources-section">
      <div className="resources-label" style={{ marginBottom: 12 }}>
        Specialty Drug Lists — Florida Blue
      </div>

      <div className="spec-tabs">
        <button
          className={`spec-tab ${tab === 'self' ? 'active' : ''}`}
          onClick={() => { setTab('self'); setQuery('') }}>
          Self-Administered
        </button>
        <button
          className={`spec-tab ${tab === 'prov' ? 'active' : ''}`}
          onClick={() => { setTab('prov'); setQuery('') }}>
          Provider-Administered
        </button>
      </div>

      <div className="spec-search-wrap">
        <input
          className="spec-search"
          placeholder={`Search ${tab === 'self' ? 'self-administered' : 'provider-administered'} specialty drugs…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {query && <button className="spec-clear" onClick={() => setQuery('')}>✕</button>}
      </div>

      {q.length >= 2 && (
        <div className="spec-results">
          {isNc && (
            <div className="spec-not-covered">
              Not on current formulary. Please see drugs not covered and consider an alternative option.
            </div>
          )}
          {notFound && (
            <div className="spec-not-found">Drug not found in Specialty List.</div>
          )}
          {results.map((drug, i) => <DrugResult key={i} drug={drug} />)}
        </div>
      )}

      <div className="spec-note">
        Florida Blue only · Current 4/1/26 · Generics in lowercase · Brands Capitalized
      </div>
    </div>
  )
}
