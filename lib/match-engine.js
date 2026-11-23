// Moteur déterministe d'analyse descriptive des résultats déjà terminés.
// Il ne calcule aucune probabilité et ne produit aucune prévision de rencontre future.
const numberOrNull = value => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function validRows(rows = []) {
  return rows.filter(row =>
    numberOrNull(row?.goalsFor) !== null &&
    numberOrNull(row?.goalsAgainst) !== null
  );
}

function resultOf(row) {
  if (["W", "D", "L"].includes(row.result)) return row.result;
  const a = numberOrNull(row.goalsFor), b = numberOrNull(row.goalsAgainst);
  return a > b ? "W" : a < b ? "L" : "D";
}

function summarize(rows = []) {
  const valid = validRows(rows);
  const n = valid.length;
  const sumFor = valid.reduce((sum, row) => sum + numberOrNull(row.goalsFor), 0);
  const sumAgainst = valid.reduce((sum, row) => sum + numberOrNull(row.goalsAgainst), 0);
  return {
    matches: n,
    wins: valid.filter(row => resultOf(row) === "W").length,
    draws: valid.filter(row => resultOf(row) === "D").length,
    losses: valid.filter(row => resultOf(row) === "L").length,
    averageFor: n ? Number((sumFor / n).toFixed(2)) : null,
    averageAgainst: n ? Number((sumAgainst / n).toFixed(2)) : null,
    cleanSheets: valid.filter(row => numberOrNull(row.goalsAgainst) === 0).length
  };
}

function scorePatterns(rows = [], limit = 3) {
  const counts = new Map();
  for (const row of validRows(rows)) {
    const score = numberOrNull(row.goalsFor) + "-" + numberOrNull(row.goalsAgainst);
    counts.set(score, (counts.get(score) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => b.count - a.count || a.score.localeCompare(b.score, "en", { numeric: true }))
    .slice(0, limit);
}

function signed(value) {
  return (value > 0 ? "+" : "") + value.toFixed(2);
}

function formLabel(stats) {
  return stats.matches
    ? stats.wins + " victoire(s), " + stats.draws + " nul(s), " + stats.losses + " défaite(s)"
    : "aucun résultat exploitable";
}

function teamAnalysis(name, rows, venue) {
  const stats = summarize(rows);
  const venueRows = validRows(rows).filter(row => row.homeAway === venue);
  const venueStats = summarize(venueRows);
  const patterns = scorePatterns(rows);
  return { name, stats, venue: venueStats, historicalScores: patterns };
}

function teamLines(team, venueLabel, unit) {
  const s = team.stats, v = team.venue;
  const lines = [
    team.name + " — " + s.matches + " match(s) : " + formLabel(s) + ".",
    s.matches
      ? "Production : " + s.averageFor + " " + unit + " marqué(s) et " + s.averageAgainst + " encaissé(s) par match ; " + s.cleanSheets + " match(s) sans encaisser."
      : "Moyennes offensives et défensives indisponibles faute de résultats valides.",
    v.matches
      ? venueLabel + " : " + v.matches + " match(s), " + formLabel(v) + " ; moyennes " + v.averageFor + " marqué(s) et " + v.averageAgainst + " encaissé(s)."
      : venueLabel + " : échantillon indisponible ou trop faible."
  ];
  return lines;
}

/**
 * Entrées attendues : home.recent, away.recent et headToHead.matches.
 * Les scores historiques sont ceux des archives, jamais des scores annoncés pour le prochain match.
 */
export function analyzeMatchHistory({
  home = {},
  away = {},
  headToHead = {},
  unit = "but(s)"
} = {}) {
  const homeRows = Array.isArray(home.recent) ? home.recent : [];
  const awayRows = Array.isArray(away.recent) ? away.recent : [];
  const h2hRows = Array.isArray(headToHead.matches) ? headToHead.matches : [];
  const homeName = home.name || "Équipe à domicile";
  const awayName = away.name || "Équipe à l’extérieur";
  const homeReport = teamAnalysis(homeName, homeRows, "home");
  const awayReport = teamAnalysis(awayName, awayRows, "away");
  const h2hStats = summarize(h2hRows);
  const h2hScores = scorePatterns(h2hRows);

  const comparison = [];
  const interpretations = [];
  if (homeReport.stats.matches && awayReport.stats.matches) {
    const attackGap = Number((homeReport.stats.averageFor - awayReport.stats.averageFor).toFixed(2));
    const defenseGap = Number((homeReport.stats.averageAgainst - awayReport.stats.averageAgainst).toFixed(2));
    comparison.push("Écart de moyenne offensive (domicile − extérieur) : " + signed(attackGap) + " " + unit + "/match.");
    comparison.push("Écart de moyenne encaissée (domicile − extérieur) : " + signed(defenseGap) + " " + unit + "/match.");
    if (Math.abs(attackGap) < 0.15) interpretations.push("Les moyennes offensives des deux équipes sont proches dans les échantillons consultés.");
    else interpretations.push((attackGap > 0 ? homeName : awayName) + " a la moyenne offensive historique la plus élevée sur cet échantillon.");
    if (Math.abs(defenseGap) < 0.15) interpretations.push("Les moyennes encaissées sont proches ; aucune différence nette ne ressort sur cet indicateur.");
    else interpretations.push((defenseGap < 0 ? homeName : awayName) + " a encaissé moins de " + unit + " par match dans l’échantillon comparé.");
  } else {
    comparison.push("Comparaison limitée : il manque un échantillon exploitable pour l’une des équipes.");
    interpretations.push("Les données disponibles ne permettent pas de comparaison équilibrée.");
  }

  const coverage = {
    homeMatches: homeReport.stats.matches,
    awayMatches: awayReport.stats.matches,
    headToHeadMatches: h2hStats.matches,
    sufficient: homeReport.stats.matches >= 5 && awayReport.stats.matches >= 5
  };
  const homeScores = homeReport.historicalScores.map(x => x.score + " (" + x.count + ")");
  const awayScores = awayReport.historicalScores.map(x => x.score + " (" + x.count + ")");
  const directScores = h2hScores.map(x => x.score + " (" + x.count + ")");
  const lines = [
    "LECTURE DU MATCH — ANALYSE DES DONNÉES HISTORIQUES",
    "",
    "1. FORME ET PRODUCTION",
    ...teamLines(homeReport, "À domicile", unit),
    "",
    ...teamLines(awayReport, "À l’extérieur", unit),
    "",
    "2. COMPARAISON DES INDICATEURS",
    ...comparison,
    ...interpretations.map(line => "Lecture : " + line),
    "",
    "3. CONFRONTATIONS DIRECTES",
    h2hStats.matches
      ? h2hStats.matches + " confrontation(s) exploitable(s) retrouvée(s) : " + formLabel(h2hStats) + "."
      : "Aucune confrontation directe exploitable retrouvée dans les calendriers consultés. Les archives peuvent être incomplètes.",
    "",
    "4. SCORES OBSERVÉS DANS LES ARCHIVES (PAS DES SCORES PRÉVUS)",
    homeName + " : " + (homeScores.join(", ") || "non disponible") + ".",
    awayName + " : " + (awayScores.join(", ") || "non disponible") + ".",
    "Face-à-face, du point de vue de l’équipe à domicile : " + (directScores.join(", ") || "non disponible") + ".",
    "",
    "5. QUALITÉ DES DONNÉES",
    coverage.sufficient
      ? "Échantillon : au moins 5 matchs valides par équipe."
      : "Échantillon limité : moins de 5 matchs valides pour au moins une équipe ; interpréter les écarts avec prudence.",
    "Même historique = même analyse. Aucun tirage aléatoire, aucune probabilité de victoire et aucun score futur ne sont générés."
  ];
  return {
    coverage,
    home: homeReport,
    away: awayReport,
    headToHead: h2hStats,
    comparison,
    interpretations,
    text: lines.join("\n")
  };
}
