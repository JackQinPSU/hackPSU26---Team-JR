const WEIGHTS = { M: 0.30, D: 0.25, R: 0.25, E: 0.20 };

const PENALTY_VALUES = {
  saturated_market: 8,
  high_tech_risk:   5,
  no_monetization:  10,
  regulatory_risk:  7,
};

function calcScore(dims, penalties) {
  const weighted =
    (dims.M * WEIGHTS.M) +
    (dims.D * WEIGHTS.D) +
    (dims.R * WEIGHTS.R) +
    (dims.E * WEIGHTS.E);

  const penaltyTotal = Object.entries(penalties || {})
    .filter(([, active]) => active)
    .reduce((sum, [key]) => sum + (PENALTY_VALUES[key] || 0), 0);

  return Math.round(Math.max(0, Math.min(100, weighted - penaltyTotal)));
}

function getVerdict(score) {
  if (score >= 88) return "Exceptional";
  if (score >= 75) return "Strong idea";
  if (score >= 65) return "Promising";
  if (score >= 50) return "Needs work";
  return "Weak idea";
}

// Returns a short, specific reason based on what drove the score up or down.
function getVerdictReason(dims, penalties, score) {
  const activePenalties = Object.entries(penalties || {}).filter(([, v]) => v).map(([k]) => k);

  // Find the weakest and strongest dimension
  const dimEntries = Object.entries(dims); // [M, D, R, E]
  const weakest  = dimEntries.reduce((a, b) => a[1] < b[1] ? a : b);
  const strongest = dimEntries.reduce((a, b) => a[1] > b[1] ? a : b);

  const DIM_LABELS = { M: "market opportunity", D: "differentiation", R: "revenue clarity", E: "execution feasibility" };
  const PENALTY_LABELS = {
    saturated_market: "highly saturated market",
    high_tech_risk:   "high technical risk",
    no_monetization:  "unclear monetization",
    regulatory_risk:  "regulatory exposure",
  };

  const parts = [];

  if (score >= 75) {
    parts.push(`Strong ${DIM_LABELS[strongest[0]]} (${strongest[1]})`);
    if (weakest[1] < 65) parts.push(`but ${DIM_LABELS[weakest[0]]} needs work (${weakest[1]})`);
  } else if (score >= 50) {
    parts.push(`${DIM_LABELS[weakest[0]]} is the weak point (${weakest[1]})`);
    if (strongest[1] >= 70) parts.push(`${DIM_LABELS[strongest[0]]} is solid (${strongest[1]})`);
  } else {
    parts.push(`Low scores across ${DIM_LABELS[weakest[0]]} (${weakest[1]}) and ${DIM_LABELS[strongest[0]]} (${strongest[1]})`);
  }

  if (activePenalties.length) {
    parts.push(`penalized for ${activePenalties.map(p => PENALTY_LABELS[p]).join(" and ")}`);
  }

  return parts.join("; ") + ".";
}

module.exports = { calcScore, getVerdict, getVerdictReason };
