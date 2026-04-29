// PHI detection patterns
const PHI_PATTERNS = [
  // Names with context
  /\b(patient|pt|mr|mrs|ms|dr)\.?\s+[a-z]{2,}\s+[a-z]{2,}/i,
  // DOB patterns
  /\b(dob|date of birth|born|birthday)\s*:?\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/i,
  /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/,
  // MRN patterns
  /\b(mrn|medical record|chart)\s*[:#]?\s*\d{4,}/i,
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/,
  // Phone numbers
  /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  // Email addresses
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
  // Insurance ID patterns
  /\b(member id|insurance id|policy|group)\s*[:#]?\s*[a-z0-9]{6,}/i,
  // Address patterns
  /\b\d+\s+[a-z]+\s+(st|ave|blvd|rd|dr|ln|way|ct|pl)\b/i,
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
