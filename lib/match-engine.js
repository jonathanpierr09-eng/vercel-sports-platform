// Deterministic descriptive engine for completed-match history only.
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

function summarize(rows = []) {
  const valid = rows.filter(row => finite(row.goalsFor) !== null && finite(row.goalsAgainst) !== null);
  const n = valid.length;
  const sumFor = valid.reduce((s, row) => s + Number(row.goalsFor), 0);
  const sumAgainst = valid.reduce((s, row) => s + Number(row.goalsAgainst), 0);
  return {
    matches: n,
    wins: valid.filter(row => row.result === "W").length,
    draws: valid.filter(row => row.result === "D").length,
    losses: valid.filter(row => row.result === "L").length,
    averageFor: n ? Number((sumFor / n).toFixed(2)) : null,
    averageAgainst: n ? Number((sumAgainst / n).toFixed(2)) : null,
    cleanSheets: valid.filter(row => Number(row.goalsAgainst) === 0).length
  };
}

function scorePatterns(rows = [], limit = 3) {
  const counts = new Map();
  for (const row of rows) {
    const a = finite(row.goalsFor), b = finite(row.goalsAgainst);
    if (a === null || b === null) continue;
    const score = a + "-" + b;
    counts.set(score, (counts.get(score) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => b.count - a.count || a.score.localeCompare(b.score, "en", { numeric: true }))
    .slice(0, limit);
}

function describeTeam(name, stats, venueRows, scoreRows) {
  const venue = summarize(venueRows);
  const patterns = scorePatterns(scoreRows);
  const sample = stats.matches + " match(s)";
  const form = stats.matches
    ? stats.wins + " victoire(s), " + stats.draws + " nul(s), " + stats.losses + " défaite(s)"
    : "échantillon insuffisant";
  const goals = stats.matches
    ? "moyennes de " + stats.averageFor + " marqué(s) et " + stats.averageAgainst + " encaissé(s)"
    : "moyennes de buts/points indisponibles";
  const venueText = venue.matches
    ? "Sur " + venue.matches + " match(s) dans ce contexte : " + venue.wins + " victoire(s), " +
      venue.draws + " nul(s), " + venue.losses + " défaite(s), moyenne marquée " +
      venue.averageFor + " et moyenne encaissée " + venue.averageAgainst + "."
    : "Pas assez de matchs classés dans ce contexte domicile/extérieur.";
  return {
    name, stats, venue,
    text: name + " : " + sample + ", " + form + ", " + goals + ". " + venueText,
    historicalScores: patterns
  };
}

/**
 * @param {{home:{stats?:object,recent?:Array},away:{stats?:object,recent?:Array},headToHead?:{matches?:Array}}} input
 * @returns A deterministic descriptive report; never forecasts a future result.
 */
export function analyzeMatchHistory({ home = {}, away = {}, headToHead = {} } = {}) {
  const homeRows = Array.isArray(home.recent) ? home.recent : [];
  const awayRows = Array.isArray(away.recent) ? away.recent : [];
  const h2hRows = Array.isArray(headToHead.matches) ? headToHead.matches : [];
  const homeStats = summarize(homeRows);
  const awayStats = summarize(awayRows);
  const homeReport = describeTeam("Équipe à domicile", homeStats,
    homeRows.filter(row => row.homeAway === "home"), homeRows);
  const awayReport = describeTeam("Équipe à l’extérieur", awayStats,
    awayRows.filter(row => row.homeAway === "away"), awayRows);
  const h2hScores = scorePatterns(h2hRows);
  const h2hSummary = summarize(h2hRows);
  const comparison = [];
  if (homeStats.matches && awayStats.matches) {
    const attackGap = Number((homeStats.averageFor - awayStats.averageFor).toFixed(2));
    const defenseGap = Number((awayStats.averageAgainst - homeStats.averageAgainst).toFixed(2));
    comparison.push("Écart descriptif des moyennes marquées : " + (attackGap > 0 ? "+" : "") + attackGap + ".");
    comparison.push("Écart descriptif des moyennes encaissées (domicile moins extérieur) : " +
      (defenseGap > 0 ? "+" : "") + defenseGap + ".");
  } else {
    comparison.push("Comparaison directe limitée : l’un des deux échantillons est vide.");
  }
  const coverage = {
    homeMatches: homeStats.matches,
    awayMatches: awayStats.matches,
    headToHeadMatches: h2hRows.length,
    sufficient: homeStats.matches >= 5 && awayStats.matches >= 5
  };
  const lines = [
    "ANALYSE STATISTIQUE JS — RÉSULTATS HISTORIQUES",
    homeReport.text,
    awayReport.text,
    ...comparison,
    "Confrontations directes : " + h2hRows.length + " match(s) retrouvé(s)" +
      (h2hRows.length ? " ; bilan du point de vue de l’équipe à domicile : " +
        h2hSummary.wins + " victoire(s), " + h2hSummary.draws + " nul(s), " +
        h2hSummary.losses + " défaite(s)." : "."),
    "Scores exacts les plus fréquents dans les archives (constat historique, pas une projection) :",
    "Équipe domicile, score pour–contre : " + (homeReport.historicalScores.map(x => x.score + " (" + x.count + ")").join(", ") || "non disponible") + ".",
    "Équipe extérieur, score pour–contre : " + (awayReport.historicalScores.map(x => x.score + " (" + x.count + ")").join(", ") || "non disponible") + ".",
    "Confrontations directes, score du point de vue domicile : " + (h2hScores.map(x => x.score + " (" + x.count + ")").join(", ") || "non disponible") + ".",
    coverage.sufficient
      ? "Couverture : au moins 5 matchs récents par équipe."
      : "Couverture limitée : moins de 5 matchs disponibles pour au moins une équipe.",
    "Méthode déterministe : mêmes données = même rapport. Aucune donnée aléatoire ni estimation de résultat futur."
  ];
  return { coverage, home: homeReport, away: awayReport, headToHead: h2hSummary, comparison, text: lines.join("\n") };
}
