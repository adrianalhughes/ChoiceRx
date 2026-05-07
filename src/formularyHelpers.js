import stepTherapy from './data/step_therapy.json'

export function normalizeDrugName(value) {
  return (value || '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function stripParentheticalText(value) {
  return (value || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
}

export function getLeadingBrandCandidate(drugName) {
  if (!drugName || !drugName.includes(' - ')) return null
  const leading = drugName.split(' - ')[0].trim()
  if (!leading) return null
  return leading
}

export function matchesBrandName(drugName, query) {
  const normalizedQuery = normalizeDrugName(query)
  if (!normalizedQuery) return false

  const leadingBrand = getLeadingBrandCandidate(drugName)
  if (!leadingBrand) return false
  const normalizedBrand = normalizeDrugName(leadingBrand)
  return normalizedBrand === normalizedQuery || normalizedBrand.includes(normalizedQuery)
}

const STEP_THERAPY_ENTRIES = Object.entries(stepTherapy).map(([key, prerequisites]) => ({
  key,
  normalizedKey: normalizeDrugName(key),
  prerequisites,
}))

export function lookupStepTherapyByTerm(term, { allowContains = true } = {}) {
  if (!term) return null
  const normalizedTerm = normalizeDrugName(term)
  if (!normalizedTerm) return null

  for (const entry of STEP_THERAPY_ENTRIES) {
    if (entry.normalizedKey === normalizedTerm) return entry.prerequisites
  }

  if (allowContains) {
    for (const entry of STEP_THERAPY_ENTRIES) {
      if (normalizedTerm.includes(entry.normalizedKey) || entry.normalizedKey.includes(normalizedTerm)) {
        return entry.prerequisites
      }
    }
  }
  return null
}

export function lookupStepTherapyForDrug(drugName) {
  if (!drugName) return null
  const canonicalDrugName = stripParentheticalText(drugName)

  const fullMatch = lookupStepTherapyByTerm(canonicalDrugName, { allowContains: false })
  if (fullMatch) return fullMatch

  const leadingBrand = getLeadingBrandCandidate(drugName)
  if (leadingBrand) {
    const leadingMatch = lookupStepTherapyByTerm(leadingBrand, { allowContains: false })
    if (leadingMatch) return leadingMatch
  }

  return null
}

export function lookupStepTherapyForQuery(query) {
  if (!query) return null
  return lookupStepTherapyByTerm(query)
}
