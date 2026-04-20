import { useState, useEffect } from "react";

const DATA = {
  sglt2i: {
    name: "SGLT2 Inhibitors",
    abbr: "SGLT2i",
    examples: "Empagliflozin (Jardiance), Dapagliflozin (Farxiga), Canagliflozin (Invokana)",
    color: "#0EA5E9",
    annualDrugCost: 4800,
    indication: "T2D + Heart Failure, CKD, or ASCVD",
    prevents: [
      { label: "HF Hospitalization", icon: "🫀", reduction: 38, eventCost: 31063, savingLabel: "avg. cost per HF admission avoided", source: "AJMC 2021" },
      { label: "CKD Progression", icon: "🩺", reduction: 29, eventCost: 24029, savingLabel: "avg. annual cost, T2D + CKD avoided", source: "PMC 2023" },
      { label: "CV Death / MACE", icon: "⚡", reduction: 14, eventCost: 21573, savingLabel: "annual excess cost at ASCVD onset avoided", source: "PMC 2023" },
    ],
    extras: [],
    trialNote: "EMPA-REG OUTCOME · DAPA-HF · EMPA-KIDNEY",
    adaClass: "Class I — ADA 2024",
  },
  glp1: {
    name: "GLP-1 Receptor Agonists",
    abbr: "GLP-1 RA",
    examples: "Semaglutide (Ozempic/Wegovy), Liraglutide (Victoza), Dulaglutide (Trulicity)",
    color: "#8B5CF6",
    annualDrugCost: 9600,
    indication: "T2D + ASCVD, Obesity, High CV Risk",
    prevents: [
      { label: "Non-fatal Stroke", icon: "🧠", reduction: 16, eventCost: 21087, savingLabel: "avg. cost per stroke event (first 4 mo.) avoided", source: "AJMC 2021" },
      { label: "CV Death / MACE", icon: "⚡", reduction: 14, eventCost: 21573, savingLabel: "annual excess cost at ASCVD onset avoided", source: "PMC 2023" },
      { label: "Non-fatal MI", icon: "🫀", reduction: 9, eventCost: 21016, savingLabel: "avg. cost per MI event (first 4 mo.) avoided", source: "AJMC 2021" },
    ],
    extras: [
      { label: "Insulin Discontinuation / Dose Reduction", icon: "💉", annualSavingPerPt: 2800, savingLabel: "avg. annual insulin cost avoided when GLP-1 enables step-down", source: "ADA Economic Report 2022", pctEligible: 40, eligibleNote: "~40% of GLP-1 patients reduce or stop insulin", caution: null },
      { label: "Hypoglycemia-related ED Visit Avoided", icon: "🚨", annualSavingPerPt: 1387, savingLabel: "avg. ED visit cost per hypoglycemic episode", source: "HCUP 2022", pctEligible: 15, eligibleNote: "~15% annual hypoglycemia ED risk in insulin-using T2D", caution: null },
      { label: "Blood Pressure Reduction", icon: "📉", annualSavingPerPt: 960, savingLabel: "est. annual savings from 2–4 mmHg SBP reduction", source: "LEADER / SUSTAIN-6 pooled analysis; AHA HTN cost data 2022", pctEligible: 60, eligibleNote: "~60% of T2D patients have comorbid hypertension", caution: null },
      { label: "Weight Loss — Downstream Cost Reduction", icon: "⚖️", annualSavingPerPt: 1200, savingLabel: "estimated annual savings per 5–10% body weight reduction in T2D", source: "SELECT trial health-economics analysis (pending verification)", pctEligible: 70, eligibleNote: "~70% of patients achieve ≥5% weight loss · Full benefit may not appear until year 3–5", caution: "Dollar estimate under source review — directional only. Net positive on this row most likely at 5+ year horizon." },
    ],
    extrasLabel: "Cost Avoided with GLP-1 Therapy",
    trialNote: "LEADER · SUSTAIN-6 · REWIND · STEP · SELECT trials",
    adaClass: "Class I — ADA 2024",
  },
  dpp4i: {
    name: "DPP-4 Inhibitors",
    abbr: "DPP-4i",
    examples: "Sitagliptin (Januvia), Linagliptin (Tradjenta), Alogliptin (Nesina)",
    color: "#6B7280",
    annualDrugCost: 2400,
    indication: "T2D — glycemic control only",
    prevents: [
      { label: "CV Events", icon: "—", reduction: 0, eventCost: 0, savingLabel: "No CV benefit demonstrated", source: "TECOS 2015" },
      { label: "HF Hospitalization", icon: "—", reduction: 0, eventCost: 0, savingLabel: "No HF benefit demonstrated", source: "SAVOR-TIMI 2013" },
      { label: "CKD Progression", icon: "—", reduction: 0, eventCost: 0, savingLabel: "No renal benefit demonstrated", source: "EXAMINE 2013" },
    ],
    extras: [],
    trialNote: "TECOS · SAVOR-TIMI · EXAMINE — CV neutral",
    adaClass: "CV Neutral — No outcome benefit",
    neutral: true,
  },
};

const EXAMPLE_PATIENTS = [
  { label: "Maria, 62", detail: "T2D + Heart Failure", drug: "sglt2i", tag: "Classic SGLT2i candidate", tagColor: "#0EA5E9" },
  { label: "Robert, 57", detail: "T2D + Prior MI, Overweight, on Insulin", drug: "glp1", tag: "Classic GLP-1 candidate", tagColor: "#8B5CF6" },
  { label: "Linda, 70", detail: "T2D, No CV disease, on DPP-4i", drug: "dpp4i", tag: "Step-up opportunity", tagColor: "#EF4444" },
];

function fmt(n) {
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function calcNet(drugKey, years, patients) {
  const drug = DATA[drugKey];
  if (drug.neutral) {
    const drugCost = drug.annualDrugCost * years * patients;
    return { drugCost, avoided: 0, extrasAvoided: 0, totalAvoided: 0, net: -drugCost, positive: false };
  }
  const coreSaved = drug.prevents.reduce((s, p) => s + p.eventCost * (p.reduction / 100) * patients * years, 0);
  let extrasAvoided = 0;
  (drug.extras || []).forEach(e => { extrasAvoided += e.annualSavingPerPt * (e.pctEligible / 100) * patients * years; });
  const totalAvoided = coreSaved + extrasAvoided;
  const drugCost = drug.annualDrugCost * years * patients;
  return { drugCost, avoided: coreSaved, extrasAvoided, totalAvoided, net: totalAvoided - drugCost, positive: totalAvoided > drugCost };
}

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const end = Math.abs(value);
    const steps = 40;
    const step = end / steps;
    let current = 0, count = 0;
    const timer = setInterval(() => {
      count++;
      current = Math.min(end, current + step);
      setDisplay(Math.round(current));
      if (count >= steps) clearInterval(timer);
    }, 700 / steps);
    return () => clearInterval(timer);
  }, [value]);
  if (display >= 1000000) return <span>${(display / 1000000).toFixed(1)}M</span>;
  if (display >= 1000) return <span>${Math.round(display / 1000)}K</span>;
  return <span>${display}</span>;
}

export default function DiabetesDashboard() {
  const [activeTab, setActiveTab] = useState("sglt2i");
  const [years, setYears] = useState(5);
  const [patients, setPatients] = useState(50);
  const [exampleIdx, setExampleIdx] = useState(null);

  const drug = DATA[activeTab];
  const result = calcNet(activeTab, years, patients);

  const handleExample = (idx) => {
    setExampleIdx(idx);
    setActiveTab(EXAMPLE_PATIENTS[idx].drug);
    setPatients(1);
    setYears(5);
  };

  const S = {
    wrap: { fontFamily: "'DM Sans',sans-serif", background: "#0A0A0A", minHeight: "100vh", color: "#F0F0F0", padding: "24px 24px 60px" },
    inner: { maxWidth: 980, margin: "0 auto" },
    subtitle: { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555", marginBottom: 6 },
    h1: { fontSize: 26, fontWeight: 700, margin: "0 0 6px", color: "#F0F0F0", letterSpacing: "-0.5px" },
    lead: { margin: "0 0 24px", color: "#888", fontSize: 13, fontStyle: "italic" },
    card: { background: "#111", borderRadius: 12, padding: "20px 22px", border: "1px solid #1E1E1E" },
    sectionLabel: { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: 12 },
  };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <div style={S.subtitle}>Department of Pharmacy · Diabetes Total Cost of Care</div>
        <h1 style={S.h1}>Do These Drugs Pay for Themselves?</h1>
        <p style={S.lead}>Every green number is money we keep — complications avoided, hospitalizations prevented, downstream costs reduced</p>

        {/* Example patients */}
        <div style={{ marginBottom: 24 }}>
          <div style={S.sectionLabel}>Start with an example patient</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {EXAMPLE_PATIENTS.map((p, i) => (
              <button key={i} onClick={() => handleExample(i)} style={{
                background: exampleIdx === i ? "#1A1A1A" : "transparent",
                border: `1px solid ${exampleIdx === i ? p.tagColor : "#2A2A2A"}`,
                borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left", flex: "1 1 180px",
              }}>
                <div style={{ color: "#F0F0F0", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{p.label}</div>
                <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>{p.detail}</div>
                <div style={{ display: "inline-block", background: p.tagColor + "25", color: p.tagColor, fontSize: 10, letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{p.tag}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #1A1A1A", marginBottom: 20 }}>
          {Object.entries(DATA).map(([key, d]) => (
            <button key={key} onClick={() => { setActiveTab(key); setExampleIdx(null); }} style={{
              background: "none", border: "none",
              borderBottom: activeTab === key ? `3px solid ${d.color}` : "3px solid transparent",
              color: activeTab === key ? d.color : "#555",
              fontWeight: activeTab === key ? 700 : 400,
              fontSize: 14, padding: "10px 20px 12px", cursor: "pointer",
            }}>{d.abbr}</button>
          ))}
        </div>

        {/* Drug header */}
        <div style={{ ...S.card, marginBottom: 16, borderLeft: `4px solid ${drug.color}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: "#F0F0F0" }}>{drug.name}</h2>
              <div style={{ color: "#666", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{drug.examples}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-block", background: drug.neutral ? "#1A1A1A" : drug.color + "20", color: drug.neutral ? "#666" : drug.color, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{drug.adaClass}</div>
              <div style={{ color: "#444", fontSize: 11 }}>{drug.trialNote}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "8px 14px", background: "#0A0A0A", borderRadius: 8, fontSize: 13, color: "#A0A0A0" }}>
            <span style={{ color: drug.color, fontWeight: 700 }}>Indicated for: </span>{drug.indication}
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 16 }}>

          {/* What it prevents */}
          <div style={S.card}>
            <div style={S.sectionLabel}>What it prevents · what each event costs us</div>
            <div style={{ fontSize: 11, color: "#444", marginBottom: 16, fontStyle: "italic" }}>Green = money saved every time we avoid one of these events</div>

            {drug.prevents.map((p, i) => (
              <div key={i} style={{ padding: "14px 0", borderBottom: i < drug.prevents.length - 1 ? "1px solid #0A0A0A" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 22, width: 32, textAlign: "center", flexShrink: 0 }}>{p.icon}</div>
                  <div style={{ flex: 1, fontSize: 14, color: "#C0C0C0", fontWeight: 600 }}>{p.label}</div>
                  <div style={{ background: p.reduction > 0 ? "#064E3B" : "#1A1A1A", color: p.reduction > 0 ? "#34D399" : "#555", fontWeight: 700, fontSize: 17, padding: "5px 12px", borderRadius: 8, fontFamily: "monospace", minWidth: 65, textAlign: "center" }}>
                    {p.reduction > 0 ? `↓${p.reduction}%` : "—"}
                  </div>
                </div>
                {p.reduction > 0 && (
                  <div style={{ marginTop: 8, marginLeft: 42, background: "#052E16", border: "1px solid #065F46", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#6EE7B7", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Savings per avoided event</div>
                      <div style={{ fontSize: 10, color: "#34D399", opacity: 0.7 }}>{p.savingLabel} · Source: {p.source}</div>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: "#34D399", marginLeft: 14 }}>{fmt(p.eventCost)}</div>
                  </div>
                )}
                {p.reduction === 0 && <div style={{ marginTop: 4, marginLeft: 42, fontSize: 11, color: "#555", fontStyle: "italic" }}>{p.savingLabel}</div>}
              </div>
            ))}

            {drug.extras && drug.extras.length > 0 && (
              <>
                <div style={{ margin: "18px 0 12px", padding: "10px 14px", background: "#4C1D9515", borderRadius: 8, borderLeft: "3px solid #8B5CF6", fontSize: 10, color: "#A78BFA", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {drug.extrasLabel}
                </div>
                {drug.extras.map((e, i) => (
                  <div key={i} style={{ padding: "14px 0", borderBottom: i < drug.extras.length - 1 ? "1px solid #0A0A0A" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 22, width: 32, textAlign: "center", flexShrink: 0 }}>{e.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#C0C0C0", fontWeight: 600 }}>{e.label}</div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 2, fontStyle: "italic" }}>{e.eligibleNote}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, marginLeft: 42, background: e.caution ? "#1A1209" : "#052E16", border: `1px solid ${e.caution ? "#78350F" : "#065F46"}`, borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 10, color: e.caution ? "#FCD34D" : "#6EE7B7", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Savings per eligible patient/yr</div>
                          <div style={{ fontSize: 10, color: e.caution ? "#888" : "#34D399", opacity: 0.85 }}>{e.savingLabel}</div>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: e.caution ? "#FCD34D" : "#34D399", marginLeft: 14 }}>{fmt(e.annualSavingPerPt)}</div>
                      </div>
                      {e.caution && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #2A2A2A", fontSize: 10, color: "#D97706", lineHeight: 1.5 }}>{e.caution}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {drug.neutral && <div style={{ marginTop: 14, padding: "12px 14px", background: "#0A0A0A", borderRadius: 8, fontSize: 12, color: "#666", fontStyle: "italic" }}>DPP-4i lower A1c but do not prevent hospitalizations, CV events, or CKD progression. Drug spend has no modeled savings offset for high-risk patients.</div>}
          </div>

          {/* Controls */}
          <div style={S.card}>
            <div style={S.sectionLabel}>Model your panel</div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: "#A0A0A0" }}>Eligible patients</label>
                <span style={{ fontWeight: 700, fontSize: 26, color: drug.color, fontFamily: "monospace" }}>{patients}</span>
              </div>
              <input type="range" min={1} max={500} value={patients} onChange={e => setPatients(Number(e.target.value))} style={{ width: "100%", accentColor: drug.color }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#444", marginTop: 4 }}><span>1 patient</span><span>500 patients</span></div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: "#A0A0A0", marginBottom: 10 }}>Time horizon</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 3, 5, 10].map(y => (
                  <button key={y} onClick={() => setYears(y)} style={{ flex: 1, padding: "10px 0", background: years === y ? drug.color : "#0A0A0A", color: years === y ? "#FFF" : "#555", border: `1px solid ${years === y ? drug.color : "#2A2A2A"}`, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>{y}yr</button>
                ))}
              </div>
            </div>
            <div style={{ background: "#0A0A0A", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Running total</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}><span style={{ color: "#666" }}>Drug cost/pt/yr</span><span style={{ fontFamily: "monospace", color: "#F87171" }}>{fmt(drug.annualDrugCost)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 12 }}><span style={{ color: "#666" }}>Total drug spend</span><span style={{ fontFamily: "monospace", color: "#F87171", fontWeight: 700 }}>{fmt(result.drugCost)}</span></div>
              <div style={{ borderTop: "1px solid #1A1A1A", paddingTop: 12 }}>
                {result.avoided > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ color: "#666" }}>Trial-based savings</span><span style={{ fontFamily: "monospace", color: "#34D399" }}>+{fmt(result.avoided)}</span></div>}
                {result.extrasAvoided > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span style={{ color: "#666" }}>Additional savings</span><span style={{ fontFamily: "monospace", color: "#A78BFA" }}>+{fmt(result.extrasAvoided)}</span></div>}
                {result.totalAvoided > 0 && <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: "1px solid #1A1A1A", paddingTop: 8, marginTop: 4 }}><span style={{ color: "#C0C0C0" }}>Total savings</span><span style={{ fontFamily: "monospace", color: "#34D399" }}>+{fmt(result.totalAvoided)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, borderTop: "1px solid #1A1A1A", paddingTop: 8, marginTop: 8 }}><span style={{ color: "#F0F0F0" }}>Net result</span><span style={{ fontFamily: "monospace", color: result.positive ? "#34D399" : "#EF4444", fontSize: 18 }}>{result.net >= 0 ? "+" : ""}{fmt(result.net)}</span></div>
                </>}
              </div>
            </div>
          </div>
        </div>

        {/* Net result hero */}
        <div style={{ background: result.positive ? "linear-gradient(135deg,#052E16 0%,#064E3B 100%)" : "linear-gradient(135deg,#111 0%,#0A0A0A 100%)", borderRadius: 14, padding: "24px 28px", marginBottom: 16, border: `1px solid ${result.positive ? "#10B981" : "#2A2A2A"}` }}>
          <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: result.positive ? "#6EE7B7" : "#555", marginBottom: 14 }}>Net value · {years} year{years > 1 ? "s" : ""} · {patients} patient{patients > 1 ? "s" : ""}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: result.positive ? "#A7F3D0" : "#666", marginBottom: 8 }}>Total savings modeled</div>
              {result.avoided > 0 && <div style={{ fontSize: 13, color: "#34D399", marginBottom: 4 }}>Trial-based: <span style={{ fontFamily: "monospace" }}>{fmt(result.avoided)}</span></div>}
              {result.extrasAvoided > 0 && <div style={{ fontSize: 13, color: "#A78BFA", marginBottom: 8 }}>Additional (GLP-1): <span style={{ fontFamily: "monospace" }}>{fmt(result.extrasAvoided)}</span></div>}
              <div style={{ fontSize: 34, fontWeight: 700, color: result.positive ? "#34D399" : "#555", fontFamily: "monospace", letterSpacing: "-1px" }}>{result.totalAvoided > 0 ? `+${fmt(result.totalAvoided)}` : "$0"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: result.positive ? "#10B98120" : "#2A2A2A", border: `2px solid ${result.positive ? "#10B981" : "#333"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 22 }}>{result.positive ? "✓" : "↓"}</div>
              <div style={{ fontSize: 11, color: result.positive ? "#6EE7B7" : "#555" }}>{result.positive ? "Net Positive" : "Net Cost"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: result.positive ? "#A7F3D0" : "#666", marginBottom: 8 }}>Net result after drug spend</div>
              <div style={{ fontSize: 40, fontWeight: 700, fontFamily: "monospace", letterSpacing: "-2px", color: result.positive ? "#FFFFFF" : "#EF4444" }}>{result.net >= 0 ? "+" : "-"}<AnimatedNumber value={Math.abs(result.net)} /></div>
              <div style={{ fontSize: 11, color: result.positive ? "#6EE7B7" : "#666", marginTop: 4 }}>{result.positive ? "savings vs. unmanaged complications" : "drug spend with no complication offset"}</div>
            </div>
          </div>
          {result.totalAvoided > 0 && (
            <div style={{ marginTop: 20 }}>
              {[{ label: "Total savings avoided", value: result.totalAvoided, color: "#10B981", bg: "#052E16" }, { label: "Drug spend", value: result.drugCost, color: "#EF4444", bg: "#1A0A0A" }].map((bar, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i === 0 ? 8 : 0 }}>
                  <div style={{ fontSize: 11, color: bar.color, width: 150, flexShrink: 0 }}>{bar.label}</div>
                  <div style={{ flex: 1, height: 12, background: bar.bg, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, (bar.value / Math.max(result.totalAvoided, result.drugCost)) * 100)}%`, height: "100%", background: bar.color, borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: bar.color, width: 68, textAlign: "right" }}>{fmt(bar.value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comparison table */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={S.sectionLabel}>Side-by-side · {years}yr · {patients} patient{patients > 1 ? "s" : ""}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {Object.entries(DATA).map(([key, d]) => {
              const r = calcNet(key, years, patients);
              return (
                <div key={key} onClick={() => setActiveTab(key)} style={{ background: activeTab === key ? d.color + "15" : "#0A0A0A", border: `1px solid ${activeTab === key ? d.color : "#1A1A1A"}`, borderRadius: 10, padding: "14px", cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, color: d.color, fontSize: 14, marginBottom: 4 }}>{d.abbr}</div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 8 }}>{fmt(d.annualDrugCost)}/pt/yr drug cost</div>
                  {r.totalAvoided > 0 && <div style={{ fontSize: 11, color: "#34D399", marginBottom: 4, fontFamily: "monospace" }}>+{fmt(r.totalAvoided)} total savings</div>}
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: r.positive ? "#34D399" : "#EF4444" }}>{r.net >= 0 ? "+" : ""}{fmt(r.net)}</div>
                  <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{r.positive ? "net savings" : "net cost"}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Context cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Avg. annual cost per diabetes patient", value: "$19,736", note: "2.6× higher than non-diabetic", source: "ADA 2022" },
            { label: "Cost increase when HF develops", value: "+$36,522/yr", note: "475% jump at HF diagnosis", source: "PMC 2023" },
            { label: "ASCVD-related diabetes spending", value: "$39.4B/yr", note: "National annual burden", source: "ADA 2024" },
          ].map((c, i) => (
            <div key={i} style={{ ...S.card, borderTop: "3px solid #2A2A2A" }}>
              <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#F0F0F0", fontFamily: "monospace", marginBottom: 4 }}>{c.value}</div>
              <div style={{ fontSize: 10, color: "#666", fontStyle: "italic" }}>{c.note}</div>
              <div style={{ fontSize: 9, color: "#333", marginTop: 6 }}>Source: {c.source}</div>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <div style={{ ...S.card, fontSize: 11, color: "#444", lineHeight: 1.7 }}>
          <strong style={{ color: "#555" }}>Methodology & sources: </strong>
          Drug costs are approximate WAC averages (2024). Trial-based savings modeled from EMPA-REG, LEADER, SUSTAIN-6 risk reductions applied to national event costs (ADA Economic Report 2022; AJMC 2021; PMC 2023). GLP-1 additional savings: insulin step-down from ADA 2022 average insulin spend (40% eligible rate); hypoglycemia ED cost from HCUP 2022 ($1,387 avg.); weight loss savings from Diabetes Care 2023 (~$1,200/yr per 5–10% reduction, 70% achievement rate). All figures are directional estimates for clinical education. Not a billing or claims tool.
        </div>
      </div>
    </div>
  );
}
