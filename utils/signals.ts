export function getSignals(v: any) {
  const signals: string[] = [];

  const price = v.estimated_price || 0;
  const median = v.median_price || 0;
  const hype = v.hype_score || 0;

  // UNDERVALUED
  if (median > 0 && price < median * 0.7) {
    signals.push("UNDERVALUED");
  }

  // RISING
  if (hype >= 70 && price < median) {
    signals.push("RISING");
  }

  // COLLECTOR ALERT
  if (
    (v.format || "").includes("limited") ||
    (v.format || "").includes("numbered")
  ) {
    signals.push("COLLECTOR ALERT");
  }

  // SMART BUY
  if (hype >= 50 && hype < 75 && price <= median) {
    signals.push("SMART BUY");
  }

  // OVERPRICED
  if (median > 0 && price > median * 1.5) {
    signals.push("OVERPRICED");
  }

  return signals;
}