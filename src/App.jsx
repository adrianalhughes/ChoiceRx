import DiabetesDashboard from './DiabetesDashboard'
import ClinicalAgent from './ClinicalAgent'
import uhcTexas from './data/uhc_texas.json'
import uhcTexasEssential from './data/uhc_texas_essential.json'
import { useState, useMemo } from 'react'
import bcbsfl from './data/bcbsfl.json'
import simplechoice from './data/simplechoice.json'
import notCovered from './data/not_covered.json'
import specialtySelf from './data/specialty_self.json'
import stepTherapy from './data/step_therapy.json'

const PLANS = [
  { id: 'bcbsfl',              label: 'FL ValueScript Rx',          plan: 'Florida Blue',     payer: 'Florida Blue',     effective: 'April 2026', tiers: 6, data: bcbsfl,           highlight: true  },
  { id: 'simplechoice',        label: 'FL ValueScript SimpleChoice', plan: 'Florida Blue',     payer: 'Florida Blue',     effective: 'April 2026', tiers: 6, data: simplechoice,      highlight: false },
  { id: 'uhc_texas',           label: 'TX Advantage 3-Tier',         plan: 'UnitedHealthcare', payer: 'UnitedHealthcare', effective: 'May 2026',   tiers: 3, data: uhcTexas,          highlight: true,  txTab: true  },
  { id: 'uhc_texas_essential', label: 'TX Essential 4-Tier',         plan: 'UnitedHealthcare', payer: 'UnitedHealthcare', effective: 'May 2026',   tiers: 4, data: uhcTexasEssential, highlight: true,  txTab: true  },
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

const STANDARD_CATEGORY_NAMES = [
  'Anti-Infectives',
  'Biologicals',
  'Antineoplastics',
  'Endocrine',
  'Cardiovascular',
  'Respiratory',
  'Gastrointestinal',
  'Genitourinary',
  'Central Nervous System',
  'Analgesics & Anesthetics',
  'Neuromuscular',
  'Nutritional',
  'Hematologic',
  'Topical',
  'Miscellaneous',
]

const MONTH_INDEX = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

function parseMonthYear(value) {
  if (!value || typeof value !== 'string') return null
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return null
  const month = MONTH_INDEX[match[1].toLowerCase()]
  const year = Number(match[2])
  if (month === undefined || Number.isNaN(year)) return null
  return new Date(year, month, 1).getTime()
}

function extractPlanUpdateLabel(plan) {
  const data = plan?.data
  if (data && !Array.isArray(data) && typeof data === 'object') {
    const candidates = [data.last_updated, data.lastUpdated, data.updated_at, data.as_of, data.effective]
      .filter(v => typeof v === 'string' && v.trim().length > 0)
    if (candidates[0]) return candidates[0].trim()
  }
  return plan?.effective
}

function getStandardCategoryName(conditionName) {
  const c = (conditionName || '').toLowerCase()

  if (/(antiinfect|antibacter|antiviral|antifung|antimycobacter|antiparasit)/.test(c)) return 'Anti-Infectives'
  if (/(immunological|vaccin|biologic|immune system)/.test(c)) return 'Biologicals'
  if (/(antineoplast|cancer)/.test(c)) return 'Antineoplastics'
  if (/(hormonal|diabetes|thyroid|endocrin|infertility|metabolic bone)/.test(c)) return 'Endocrine'
  if (/(cardiovascular|anticoagul|antiplatelet|blood pressure|cholesterol|heart|circulation)/.test(c)) return 'Cardiovascular'
  if (/(respiratory|pulmonary|anaphylaxis|allergies, cough, cold)/.test(c)) return 'Respiratory'
  if (/(gastrointestinal|inflammatory bowel|bowel|intestine|stomach|ulcer|acid reflux|antiemetic)/.test(c)) return 'Gastrointestinal'
  if (/(genitourinary|prostate|bladder|sexual dysfunction|kidney)/.test(c)) return 'Genitourinary'
  if (/(central nervous system|antidepress|antipsych|bipolar|sleep disorder|anxiolytic|anticonvuls|antimigraine|antiparkinson|antidementia|attention deficit)/.test(c)) return 'Central Nervous System'
  if (/(analgesic|anesthe|pain|inflammation)/.test(c)) return 'Analgesics & Anesthetics'
  if (/(skeletal muscle relax|antimyasthenic|neuromuscular|myasthenia)/.test(c)) return 'Neuromuscular'
  if (/(electrolytes|vitamins|nutrition|supplies|glucose monitoring)/.test(c)) return 'Nutritional'
  if (/(blood disorders|hematolog)/.test(c)) return 'Hematologic'
  if (/(dermatological|ophthalmic|otic|dental and oral|skin|eye|ear|mouth|throat|topical)/.test(c)) return 'Topical'

  return 'Miscellaneous'
}

// ── Regulatory Updates ─────────────────────────────────────────────────────
const UPDATES = [
  {
    id: 'caa2026',
    status: 'enacted',
    statusLabel: 'Enacted',
    jurisdictions: ['Federal'],
    title: 'Consolidated Appropriations Act, 2026 — PBM Reform Package',
    citation: 'HR 7148 · Signed Feb 3, 2026',
    summary: 'The most comprehensive federal PBM reform to date. Requires 100% pass-through of manufacturer rebates to health plans, mandates semiannual transparency reporting to employer sponsors on net drug spend and spread pricing, restricts PBM compensation for Medicare Part D to flat bona fide service fees (effective 2028), and creates an "any willing pharmacy" right for network participation. Annual audit rights granted to plan sponsors.',
    effectiveDate: 'Most provisions: 2028–2029 plan years',
    url: 'https://www.pharmacytimes.com/view/pbm-reform-within-2026-appropriations-bill-signed-into-law',
  },
  {
    id: 'helpcopays',
    status: 'pending',
    statusLabel: 'Pending — Federal',
    jurisdictions: ['Federal'],
    title: 'HELP Copays Act — Copay Accumulator / Maximizer Ban',
    citation: 'Introduced March 2025 · Bipartisan',
    summary: 'Would require health plans and PBMs to count ALL forms of copay assistance — manufacturer coupons, third-party payments, and patient assistance program funds — toward a patient\'s deductible and out-of-pocket maximum. Eliminates the core mechanism of accumulator and maximizer programs. Currently, 84% of commercially insured beneficiaries are in plans that use accumulators. Bill is in committee; no vote scheduled.',
    effectiveDate: 'Pending',
    url: 'https://www.mintz.com/insights-center/viewpoints/2025-11-04-pbm-policy-and-legislative-update-summer-fall-2025',
  },
  {
    id: 'breakup',
    status: 'pending',
    statusLabel: 'Pending — Federal',
    jurisdictions: ['Federal'],
    title: 'Break Up Big Medicine Act — PBM / Pharmacy Ownership Ban',
    citation: 'S. 3822 · Warren (D) / Hawley (R) · Introduced Feb 2026',
    summary: 'Bipartisan bill referred to the Senate Judiciary Committee that would prohibit PBMs, health insurers, and drug wholesalers from being under common ownership with pharmacies or provider groups. Targets the vertical integration of CVS/Caremark, Cigna/Express Scripts, and UnitedHealth/OptumRx. A companion House bill is anticipated.',
    effectiveDate: 'Pending',
    url: 'https://www.amcp.org/letters-statements-analysis/federal-update-senate-introduces-comprehensive-pbm-reform-legislation',
  },
  {
    id: 'dol2026',
    status: 'proposed',
    statusLabel: 'Proposed Rule',
    jurisdictions: ['Federal'],
    title: 'DOL Proposed Rule — ERISA PBM Disclosure Expansion',
    citation: 'Proposed Jan 30, 2026 · Dept. of Labor',
    summary: 'Proposed rule that would require PBMs to make sweeping compensation disclosures to fiduciaries of ERISA-governed self-insured group health plans, including fees, spread pricing, and all remuneration from manufacturers. Pairs with audit rights covering PBM affiliates, brokers, and consultants. Comment period closed; final rule timing TBD.',
    effectiveDate: 'TBD — Rulemaking in progress',
    url: 'https://www.mintz.com/insights-center/viewpoints/2026-04-22-pbm-policy-and-legislative-update-spring-2026',
  },
  {
    id: 'fl697',
    status: 'enacted',
    statusLabel: 'Enacted',
    jurisdictions: ['Florida'],
    title: 'HB 697 — PBM Pharmacy Reimbursement Parity',
    citation: 'Chapter 2026-4 · Signed Mar 25, 2026 · Effective Jul 1, 2026',
    summary: 'Prohibits PBMs from reimbursing an affiliated pharmacy at a higher rate than a non-affiliated pharmacy for the same drug and day supply. Bars PBMs from forcing pharmacies to dispense at a loss. Requires PBMs to allow pharmacies to submit consolidated appeals covering multiple adjudicated claims with the same drug and day supply in the same calendar month — reducing administrative burden on independent pharmacies.',
    effectiveDate: 'July 1, 2026',
    url: 'https://www.flsenate.gov/Session/Bill/2026/697',
  },
  {
    id: 'fl1550',
    status: 'enacted',
    statusLabel: 'In Effect',
    jurisdictions: ['Florida'],
    title: 'Prescription Drug Reform Act — PBM Licensing & Pass-Through',
    citation: 'SB 1550 · Signed May 2023 · Fully in effect Jan 2024',
    summary: 'Florida\'s landmark PBM law. Requires all PBMs doing business in Florida to obtain a certificate of authority from the Office of Insurance Regulation (OIR) — currently 71 PBMs are licensed. Mandates pass-through pricing, prohibits spread pricing, requires 100% rebate pass-through to plan sponsors, prohibits exclusive PBM-affiliated pharmacy networks, and bans surprise DIR-style clawbacks. OIR has examination and enforcement authority.',
    effectiveDate: 'In full effect',
    url: 'https://floir.gov/life-health/pbm',
  },
  {
    id: 'fl-accumulator',
    status: 'gap',
    statusLabel: 'Protection Gap',
    jurisdictions: ['Florida'],
    title: 'Copay Accumulator Protections — Not Yet Enacted in Florida',
    citation: 'No pending bill · Florida rated "D" by AIDS Institute',
    summary: 'Florida has not passed a copay accumulator ban. An estimated 75% of Florida marketplace plans include accumulator adjustment policies that prevent manufacturer copay assistance from counting toward patient deductibles or out-of-pocket maximums. Patients often exhaust copay assistance mid-year and then face the full cost of specialty drugs. The federal HELP Copays Act would provide a floor if enacted, but until then Florida fully-insured plan members remain exposed.',
    effectiveDate: 'No action',
    url: 'https://allcopayscount.org/resources/op-ed-its-time-for-florida-to-protect-copay-assistance-for-vulnerable-patients/',
  },
  {
    id: 'tx1236',
    status: 'enacted',
    statusLabel: 'In Effect',
    jurisdictions: ['Texas'],
    title: 'SB 1236 — Pharmacy Contract Protections & Audit Reform',
    citation: 'Signed by Gov. Abbott · Effective Sep 1, 2025',
    summary: 'Strengthens protections for Texas pharmacies in PBM contracts. Prohibits PBMs from denying or reducing adjudicated claims through retroactive audits except in cases of fraud or substantive dispensing error. Clarifies that clerical or record-keeping errors can only result in clawback of the dispensing fee, not the full drug cost. Requires pharmacy network contracts to include an explicit fee schedule. Backed by a Feb 2025 Texas AG opinion asserting state authority over ERISA-plan PBM activity.',
    effectiveDate: 'In effect Sep 1, 2025',
    url: 'https://capitol.texas.gov/tlodocs/89R/analysis/html/SB01236F.htm',
  },
  {
    id: 'tx1122',
    status: 'pending',
    statusLabel: 'Pending — Texas',
    jurisdictions: ['Texas'],
    title: 'SB 1122 — Extension of PBM Protections to All Health Plans (incl. ERISA)',
    citation: 'TX 89th Legislature · 2025 Session',
    summary: 'Would extend existing Texas PBM pharmacy and patient protections to ALL health benefit plans administered in the state, including self-funded ERISA-governed employer plans — which currently represent the majority of commercial coverage and are typically beyond state reach. Backed by AG Opinion KP-0480. ERISA preemption remains a legal risk; similar laws in other states have faced injunctions.',
    effectiveDate: 'Pending — session status unclear',
    url: 'https://legiscan.com/TX/supplement/SB1122/id/535000',
  },
  {
    id: 'tx-accumulator',
    status: 'gap',
    statusLabel: 'Protection Gap',
    jurisdictions: ['Texas'],
    title: 'Copay Accumulator Protections — Not Yet Enacted in Texas',
    citation: 'No enacted state ban · 26 states have passed protections',
    summary: 'Texas has not passed a copay accumulator ban. As of 2025, 26 states and DC have enacted laws requiring copay assistance to count toward cost-sharing limits; Texas is not among them. The HELP Copays Act (federal, pending) would provide a national floor if enacted. Without it, Texas commercially insured patients on specialty medications are at risk of accumulator "surprise" costs when manufacturer copay assistance is exhausted mid-year.',
    effectiveDate: 'No action',
    url: 'https://triagecancer.org/state-laws/co-pay-accumulators',
  },
]

const STATUS_STYLES = {
  enacted:  { dot: '#34d399', label: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  pending:  { dot: '#fbbf24', label: '#fbbf24', bg: 'rgba(251,191,36,0.08)'  },
  proposed: { dot: '#60a5fa', label: '#60a5fa', bg: 'rgba(96,165,250,0.08)'  },
  gap:      { dot: '#f87171', label: '#f87171', bg: 'rgba(248,113,113,0.08)' },
}

const JURISDICTION_COLORS = {
  Federal: { color: '#93c5fd', bg: 'rgba(147,197,253,0.1)' },
  Florida: { color: '#6ee7b7', bg: 'rgba(110,231,183,0.1)' },
  Texas:   { color: '#fcd34d', bg: 'rgba(252,211,77,0.1)'  },
}

function UpdateCard({ update }) {
  const [open, setOpen] = useState(false)
  const s = STATUS_STYLES[update.status]
  return (
    <div className="update-card" style={{ background: s.bg, borderColor: s.dot + '33' }}>
      <button className="update-header" onClick={() => setOpen(o => !o)}>
        <div className="update-header-left">
          <span className="update-dot" style={{ background: s.dot }} />
          <span className="update-status" style={{ color: s.label }}>{update.statusLabel}</span>
          <div className="update-jurisdictions">
            {update.jurisdictions.map(j => {
              const jc = JURISDICTION_COLORS[j]
              return <span key={j} className="update-jurisdiction" style={{ color: jc.color, background: jc.bg }}>{j}</span>
            })}
          </div>
        </div>
        <span className="update-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      <div className="update-title">{update.title}</div>
      <div className="update-citation">{update.citation}</div>
      {open && (
        <div className="update-body">
          <p className="update-summary">{update.summary}</p>
          <div className="update-footer">
            <span className="update-effective">Effective: {update.effectiveDate}</span>
            <a href={update.url} target="_blank" rel="noopener noreferrer" className="update-link">Source <ExtIcon /></a>
          </div>
        </div>
      )}
    </div>
  )
}

function LegislativeUpdates() {
  const [filter, setFilter] = useState('All')
  const tabs = ['All', 'Federal', 'Florida', 'Texas']
  const visible = filter === 'All' ? UPDATES : UPDATES.filter(u => u.jurisdictions.includes(filter))
  return (
    <div className="resources-section">
      <div className="resources-label">Regulatory &amp; Legislative Updates</div>
      <div className="update-tabs">
        {tabs.map(t => (
          <button key={t} className={`update-tab ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
      </div>
      <div className="update-list">
        {visible.map(u => <UpdateCard key={u.id} update={u} />)}
      </div>
      <div className="update-meta">Last reviewed April 26, 2026 · Information is for reference only and does not constitute legal advice.</div>
    </div>
  )
}

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

const ST_PDF_URL = 'https://www.bcbsfl.com/DocumentLibrary/Providers/Content/Rx_ResponsibleSteps.pdf'

function lookupStepTherapy(drugName) {
  return stepTherapy[drugName.toUpperCase()] || null
}

function DrugRow({ drug, q, showFlags }) {
  const [expanded, setExpanded] = useState(false)
  const flags = showFlags ? [drug.pa && 'PA', drug.st && 'ST', drug.ql && 'QL'].filter(Boolean) : []
  const stDrugs = showFlags && drug.st ? lookupStepTherapy(drug.name) : null

  return (
    <>
      <tr
        className={drug.st && showFlags ? 'drug-row-clickable' : ''}
        onClick={drug.st && showFlags ? () => setExpanded(e => !e) : undefined}
      >
        <td className="drug-name">{highlight(drug.name, q)}</td>
        <td style={{ textAlign: 'center' }}><span className={`tier-badge tier-${drug.tier}`}>{drug.tier}</span></td>
        {showFlags && (
          <>
            <td><div className="flags">{flags.map(f => <span key={f} className={`flag-chip flag-${f}`}>{f}</span>)}</div></td>
            <td>
              {drug.ql_detail && <span className="ql-detail">{drug.ql_detail}</span>}
              {drug.st && <span className="st-row-chevron">{expanded ? '▾' : '›'}</span>}
            </td>
          </>
        )}
      </tr>
      {expanded && drug.st && showFlags && (
        <tr className="st-detail-row">
          <td colSpan={4} className="st-detail-cell">
            <div className="st-detail-inner">
              <span className="st-detail-label">Step Therapy Required</span>
              {stDrugs ? (
                <>
                  <span className="st-must-try-label">Must try first:</span>
                  <ul className="st-first-line-list">
                    {stDrugs.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </>
              ) : (
                <span className="st-no-data">Step therapy required — </span>
              )}
              <a href={ST_PDF_URL} target="_blank" rel="noopener noreferrer" className="st-criteria-link">
                View full criteria <ExtIcon />
              </a>
            </div>
          </td>
        </tr>
      )}
    </>
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
                <span className="banner-label">Coverage Criteria</span>
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

function SpecialtyNotCoveredBlock({ q }) {
  const drugs = specialtySelf.not_covered
  const filtered = q ? drugs.filter(d => d.name.toLowerCase().includes(q)) : drugs
  const [open, setOpen] = useState(false)
  return (
    <div className={`special-block notcovered-block ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
      <div className="special-block-header">
        <span className="special-block-chevron">{open ? '▾' : '›'}</span>
        <span className="special-block-title">Specialty Drugs — Not Covered</span>
        <span className="meta-pill notcovered">{filtered.length} drugs</span>
      </div>
      {open && (
        <div className="special-block-body">
          <p className="notcovered-note" style={{ marginBottom: 8 }}>
            These specialty drugs are not covered under the Florida Blue ValueScript plan.
          </p>
          <table className="drug-table">
            <thead><tr><th>Drug</th><th>Flags</th></tr></thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={i}>
                  <td>{d.name}</td>
                  <td>
                    {d.ldd && <span className="flag-chip flag-ST">LDD</span>}
                    {d.pa  && <span className="flag-chip flag-PA">PA</span>}
                    {d.ql  && <span className="flag-chip flag-QL">QL</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SidebarSection({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`sbnav-section${open ? ' open' : ''}`}>
      <button className="sbnav-header" onClick={() => setOpen(o => !o)}>
        <span className="sbnav-label">{title}</span>
        <ChevronRight className="sbnav-chevron" />
      </button>
      {open && <div className="sbnav-body">{children}</div>}
    </div>
  )
}

function SidebarLink({ href, name, desc }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="sbnav-link">
      <span className="sbnav-link-text">
        <span className="sbnav-link-name">{name}</span>
        {desc && <span className="sbnav-link-desc">{desc}</span>}
      </span>
      <ExtIcon />
    </a>
  )
}

export default function App() {
  const [activePlan, setActivePlan] = useState(PLANS[0])
  const [showEstimator, setShowEstimator] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()

  const formularyLastUpdated = useMemo(() => {
    const datedPlans = PLANS
      .map(plan => {
        const effective = extractPlanUpdateLabel(plan)
        return { effective, ts: parseMonthYear(effective) }
      })
      .filter(plan => plan.ts !== null)
      .sort((a, b) => b.ts - a.ts)
    return datedPlans[0]?.effective || 'Unknown'
  }, [])

  const filtered = useMemo(() => {
    const grouped = new Map(
      STANDARD_CATEGORY_NAMES.map(name => [name, { name, cleanDrugs: [], restrictedDrugs: [], forceOpen: false }])
    )
    activePlan.data.forEach(c => {
      const category = getStandardCategoryName(c.condition)
      const group = grouped.get(category)
      if (!group) return
      const cleanDrugs = q ? c.clean.filter(d => d.name.toLowerCase().includes(q)) : c.clean
      const restrictedDrugs = q ? c.restricted.filter(d => d.name.toLowerCase().includes(q)) : c.restricted
      if (cleanDrugs.length > 0) group.cleanDrugs.push(...cleanDrugs)
      if (restrictedDrugs.length > 0) group.restrictedDrugs.push(...restrictedDrugs)
      if (q && (cleanDrugs.length > 0 || restrictedDrugs.length > 0)) group.forceOpen = true
    })
    const conditions = STANDARD_CATEGORY_NAMES
      .map(name => grouped.get(name))
      .filter(group => group && (group.cleanDrugs.length + group.restrictedDrugs.length > 0))

    const allTier6 = activePlan.data
      .flatMap(c => [...c.clean.filter(d => d.tier === 6), ...c.restricted.filter(d => d.tier === 6)])
      .sort((a, b) => a.name.localeCompare(b.name))

    const ncDrugs  = q ? notCovered.main.filter(d => d.toLowerCase().includes(q))     : notCovered.main
    const ncAppend = q ? notCovered.appendix.filter(d => d.toLowerCase().includes(q)) : notCovered.appendix

    const totalMatches = conditions.reduce((s, c) => s + c.cleanDrugs.length + c.restrictedDrugs.length, 0)
      + ncDrugs.length

    return { conditions, tier6: allTier6, ncDrugs, ncAppend, totalMatches }
  }, [activePlan.data, q])

  const [tabsOpen, setTabsOpen] = useState(false)

  return (
    <>
      <header className="app-header">
        <div>
          <div className="wordmark">Sanitas</div>
          <div className="wordmark-sub">Pharmacy Web App<sup className="beta-sup">β</sup></div>
        </div>

      </header>

      {/* ── Plan selector — collapsible ── */}
      <div className="plan-bar">
        <div className="plan-bar-inner">
          <div className="plan-heading-stack">
            <button
              className="plan-toggle-btn"
              onClick={() => setTabsOpen(o => !o)}
            >
              Choose the plan formulary
              <span className="plan-toggle-chevron">{tabsOpen ? '▾' : '›'}</span>
            </button>
            <div className="plan-last-updated">Last Updated: {formularyLastUpdated}</div>
          </div>
          {!tabsOpen && <span className="plan-separator">·</span>}
          {tabsOpen && (
            <div className="formulary-tabs">
              {PLANS.map(plan => (
                <button key={plan.id}
                  className={`formulary-tab ${activePlan.id === plan.id ? 'active' : ''} ${plan.txTab ? 'tx-tab' : 'fl-tab'}`}
                  onClick={() => { setActivePlan(plan); setQuery(''); setTabsOpen(false) }}>
                  <span className="tab-name">{plan.label}</span>
                </button>
              ))}
            </div>
          )}
          {!tabsOpen && (
            <span className="active-plan-text">{activePlan.label}</span>
          )}
        </div>
      </div>

      <main className="main-content">
        <div className="split-layout">

          {/* ── Left: Formulary ── */}
          <div className="formulary-panel">
            <div className="panel-question">What are the coverage details?</div>

            <div className="panel-search-wrap">
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
              {q && (
                <div className="search-count">
                  {filtered.totalMatches === 0 ? 'No matches found' : `${filtered.totalMatches} drug${filtered.totalMatches !== 1 ? 's' : ''} matched`}
                </div>
              )}
            </div>
            <div className={`tier-legend-inline plan-tiers-${activePlan.tiers}`}>
              {(() => {
                const labels = activePlan.tiers === 3 ? TIER_LABELS_3 : activePlan.tiers === 4 ? TIER_LABELS_4 : TIER_LABELS_6
                const cutoff = activePlan.tiers === 3 ? 1 : activePlan.tiers === 4 ? 2 : 3
                const lowTiers  = Object.entries(labels).filter(([t]) => Number(t) <= cutoff)
                const highTiers = Object.entries(labels).filter(([t]) => Number(t) >  cutoff)
                const lowLabel  = activePlan.tiers === 3 ? 'Tier 1 · Lower Cost' : activePlan.tiers === 4 ? 'Tiers 1–2 · Lower Cost' : 'Tiers 1–3 · Lower Cost'
                const highLabel = activePlan.tiers === 3 ? 'Tiers 2–3 · Mid to Higher Cost' : activePlan.tiers === 4 ? 'Tiers 3–4 · Mid to Highest Cost' : 'Tiers 4–6 · Higher Cost'
                return (
                  <>
                    <div className="legend-group">
                      <div className="legend-group-label legend-group-label-low">{lowLabel}</div>
                      <div className="legend-tier-row">
                        {lowTiers.map(([t, label]) => (
                          <div key={t} className="legend-item legend-item-low">
                            <span className={`tier-badge tier-${t}`}>{t}</span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="legend-group">
                      <div className="legend-group-label legend-group-label-high">{highLabel}</div>
                      <div className="legend-tier-row">
                        {highTiers.map(([t, label]) => (
                          <div key={t} className="legend-item legend-item-high">
                            <span className={`tier-badge tier-${t}`}>{t}</span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            <div className="covered-rx-header">Covered Rx by Category</div>

            <div className="condition-grid">
              {filtered.conditions.map(c => (
                <ConditionBlock
                  key={c.name}
                  name={c.name === 'Central Nervous System' ? 'CNS' : c.name}
                  cleanDrugs={c.cleanDrugs}
                  restrictedDrugs={c.restrictedDrugs}
                  q={q}
                  forceOpen={c.forceOpen}
                />
              ))}
            </div>

            {q && filtered.totalMatches === 0 && (
              <div className="not-found-state">
                <div className="not-found-title">No results found</div>
                <div className="not-found-actions">
                  <a href="https://www.goodrx.com" target="_blank" rel="noopener noreferrer" className="not-found-btn">Check GoodRx cash price →</a>
                  <a href="https://www.rxassist.org" target="_blank" rel="noopener noreferrer" className="not-found-btn">Search patient assistance programs →</a>
                </div>
              </div>
            )}

          </div>

          {/* ── Right: Agent + Sidebar nav ── */}
          <div className="tools-panel">
            <ClinicalAgent activePlan={activePlan} />
            <nav className="sidebar-nav">
              <div className="sidebar-nav-head">Resources</div>

              <SidebarSection title="Protocols">
                <SidebarLink
                  href="https://sites.google.com/mysanitas.com/sanitaseducationsite/adults/endocrinology/diabetes-mellitus-resouces"
                  name="Sanitas Education Site"
                  desc="Medication protocols · Endocrinology · Adults"
                />
              </SidebarSection>

              <SidebarSection title="Prior Authorizations">
                <SidebarLink
                  href="https://oidc.covermymeds.com/login?return_url=%2Foauth%2Fauthorize%3Fclient_id%3D-QXKSuZr5mOEba23vs1QzqnlFiQFwSVj70BG2nrD3SI%26nonce%3Dd25026b0bd0b60612235a1de7a171bc9%26redirect_uri%3Dhttps%253A%252F%252Faccount.covermymeds.com%252Fauth%252Fcmm_oidc%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%2520email%2520offline_access%26state%3Db42ce2e4a3453a45e9dbf64760e84d73"
                  name="CoverMyMeds Portal"
                  desc="Submit & track PA requests"
                />
                <SidebarLink
                  href="https://docs.google.com/document/d/1EsuVXqVm7wf1fea1gIxGZvqudmPOewjB/edit?usp=sharing"
                  name="CoverMyMeds Help Guide"
                  desc="Step-by-step tutorial"
                />
                <SidebarLink
                  href="https://www.myprime.com/en/forms/coverage-determination/prior-authorization.html"
                  name="PA Summaries & Fax Forms"
                  desc="Florida Blue · MyPrime"
                />
              </SidebarSection>

              <SidebarSection title="Discounts & Affordability Programs">
                <SidebarLink href="https://www.goodrx.com" name="GoodRx" desc="Cash prices at local pharmacies" />
                <SidebarLink
                  href="https://docs.google.com/spreadsheets/d/1FvY54ZzkuLdAmFtbs4lZI42Pcd5z-Q4b/edit?usp=sharing&ouid=105603016175522070259&rtpof=true&sd=true"
                  name="Sav-Rx"
                  desc="At participating Sanitas dispensing locations"
                />
                <SidebarLink href="https://costplusdrugs.com" name="Cost Plus Drugs" desc="Transparent-pricing mail pharmacy" />
                <SidebarLink href="https://trumprx.gov/" name="TrumpRx" desc="Federally negotiated IRA prices" />
                <SidebarLink href="https://www.rxassist.org" name="RxAssist" desc="Manufacturer PAPs for uninsured patients" />
                <SidebarLink
                  href="https://www.bcbsfl.com/DocumentLibrary/Providers/Content/RxF_ConditionCare.pdf"
                  name="FL Blue Condition Care List"
                  desc="Generic options for common conditions · PDF"
                />
              </SidebarSection>

              <SidebarSection title="Off-Formulary Drugs">
                <NonPreferredBlock drugs={filtered.tier6} q={q} />
                <NotCoveredBlock drugs={filtered.ncDrugs} appendixDrugs={filtered.ncAppend} q={q} />
              </SidebarSection>

            </nav>
            <a href="mailto:ahughes@mysanitas.com?subject=Sanitas Formulary — Feedback" className="sidebar-feedback">
              Report an issue
            </a>
          </div>

        </div>
      </main>

      <footer className="app-footer" style={{height:'8px',padding:0,border:'none'}} />
    </>
  )
}
