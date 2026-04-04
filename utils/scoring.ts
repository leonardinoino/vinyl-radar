import type { Release, UserPreferences } from "@/data/mockData";

export function calculateBaseScore(release: Release): number {
  let score = release.score;

  if (release.firstPress) score += 5;
  if (release.limited) score += 4;
  if (release.numbered) score += 3;
  if (release.signed) score += 2;

  if (release.price <= 30) score += 2;
  if (release.price > 50) score -= 4;

  return Math.max(0, Math.min(100, score));
}

export function calculatePersonalScore(
  release: Release,
  user: UserPreferences
): number {
  let score = calculateBaseScore(release);

  if (user.favoriteGenres.includes(release.genre)) score += 10;
  if (release.price > user.maxBudget) score -= 12;

  if (user.likesFirstPress && release.firstPress) score += 6;
  if (user.likesLimited && release.limited) score += 5;
  if (user.likesNumbered && release.numbered) score += 4;
  if (user.likesSigned && release.signed) score += 4;

  if (release.type === "Collector Pick") score += user.nichePreference;
  if (release.type === "Mainstream Breakout") score += user.mainstreamPreference;

  return Math.max(0, Math.min(100, score));
}

export function getRecommendationLabel(score: number): string {
  if (score >= 85) return "Top pick for you";
  if (score >= 70) return "Strong match";
  if (score >= 55) return "Worth monitoring";
  return "Low relevance";
}

export function getScoreReasons(
  release: Release,
  user: UserPreferences
): string[] {
  const reasons: string[] = [];

  if (user.favoriteGenres.includes(release.genre)) {
    reasons.push("Matcha i tuoi generi");
  }

  if (user.likesFirstPress && release.firstPress) {
    reasons.push("First press");
  }

  if (user.likesLimited && release.limited) {
    reasons.push("Edizione limitata");
  }

  if (user.likesNumbered && release.numbered) {
    reasons.push("Copia numerata");
  }

  if (user.likesSigned && release.signed) {
    reasons.push("Signed edition");
  }

  if (release.price <= user.maxBudget) {
    reasons.push("Dentro il tuo budget");
  } else {
    reasons.push("Fuori budget");
  }

  if (release.type === "Collector Pick" && user.nichePreference >= 7) {
    reasons.push("Perfetta per profilo collector");
  }

  if (release.type === "Mainstream Breakout" && user.mainstreamPreference >= 7) {
    reasons.push("Buon fit mainstream");
  }

  return reasons.slice(0, 4);
}