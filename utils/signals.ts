export function getSignals(v: any) {
  const signals: string[] = [];

  const price = v.estimated_price || 0;
  const median = v.median_price || 0;
  const hype = v.hype_score || 0;
  const format = (v.format || "").toLowerCase();

  if (median > 0 && price < median * 0.7) {
    signals.push("UNDERVALUED");
  }

  if (hype >= 70 && (median === 0 || price <= median)) {
    signals.push("RISING");
  }

  if (format.includes("limited") || format.includes("numbered")) {
    signals.push("COLLECTOR ALERT");
  }

  if (hype >= 50 && hype < 75 && (median === 0 || price <= median)) {
    signals.push("SMART BUY");
  }

  if (median > 0 && price > median * 1.5) {
    signals.push("OVERPRICED");
  }

  return signals;
}