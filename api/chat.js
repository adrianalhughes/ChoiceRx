// PHI detection patterns — clinical context words like "patient" are fine, we catch actual identifiers
const PHI_PATTERNS = [
  // Full names: two capitalized words after patient/mr/mrs/ms (e.g. "patient John Smith")
  /\b(patient|pt|mr|mrs|ms)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
  // DOB patterns
  /\b(dob|date of birth|born on|birthday)\s*:?\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/i,
  // Standalone date that looks like a DOB (MM/DD/YYYY)
  /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
  // MRN patterns
  /\b(mrn|medical record number|chart number)\s*[:#]?\s*\d{4,}/i,
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Phone numbers (10 digit with separators)
  /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  // Email addresses
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
  // Insurance ID patterns
  /\b(member id|insurance id|policy number|group number)\s*[:#]?\s*[a-z0-9]{6,}/i,
  // Street addresses
  /\b\d+\s+[A-Z][a-z]+\s+(Street|Avenue|Blvd|Road|Drive|Lane|Way|Court|Place|St|Ave|Rd|Dr|Ln)\b/,
]

function detectPHI(text) {
  for (const pattern of PHI_PATTERNS) {
    if (pattern.test(text)) return true
  }
  return false
}

function extractUserMessages(body) {
  return (body.messages || [])
    .filter(m => m.role === 'user')
    .map(m => typeof m.content === 'string' ? m.content : '')
    .join(' ')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Check for PHI in user messages
  const userText = extractUserMessages(req.body)
  if (detectPHI(userText)) {
    return res.status(200).json({
      content: [{
        type: 'text',
        text: '[CLINICAL KNOWLEDGE]\n⚠️ **Potential patient information detected.**\n\nThis tool cannot process messages containing patient-identifying information such as names, dates of birth, MRNs, phone numbers, or insurance IDs.\n\nPlease rephrase your question using only drug names, diagnoses, or plan names — no patient details.',
      }],
      stop_reason: 'end_turn',
    })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: { message: e.message } })
  }
}
