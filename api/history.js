// PRONO historical match data — ESPN team schedules.
const SPORTS = new Set(["soccer", "basketball", "hockey"]);
const LEAGUE_RE = /^[a-z0-9._-]{2,40}$/i;
const TEAM_RE = /^\d{1,12}$/;

function completed(event) {
  const type = event?.competitions?.[0]?.status?.type;
  return type?.completed === true || type?.state === "post";
}
function scoreValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*$/);
    return match ? Number(match[1]) : null;
  }
  if (value && typeof value === "object") {
    const candidate = value.displayValue ?? value.value;
    return scoreValue(candidate);
  }
  return null;
}
function normalize(event, teamId) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const own = competitors.find(c => String(c?.team?.id ?? c?.id) === String(teamId));
  const other = competitors.find(c => c !== own);
  if (!own || !other) return null;
  const goalsFor = scoreValue(own.score);
  const goalsAgainst = scoreValue(other.score);
  if (goalsFor === null || goalsAgainst === null) return null;
  const result = goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D";
  return {
    id: String(event.id),
    date: event.date || null,
    opponent: other.team?.displayName || other.team?.name || "Adversaire",
    opponentId: String(other.team?.id ?? other.id ?? ""),
    homeAway: own.homeAway || null,
    goalsFor,
    goalsAgainst,
    result,
    competition: event.name || event.shortName || null
  };
}
async function getSchedule(sport, league, teamId) {
  const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`);
  const response = await fetch(url, {
    headers: { "User-Agent": "PRONO/1.0", "Accept": "application/json" },
    signal: AbortSignal.timeout(7500)
  });
  if (!response.ok) throw new Error(`ESPN HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.events)) throw new Error("Format d’historique ESPN non reconnu");
  return data.events;
}
export default async function handler(req, res) {
  const { sport, league, home, away, limit = "10" } = req.query || {};
  if (!SPORTS.has(sport) || !LEAGUE_RE.test(league || "") ||
      !TEAM_RE.test(home || "") || !TEAM_RE.test(away || "") ||
      home === away || !["5", "10"].includes(String(limit))) {
    return res.status(400).json({ error: "Paramètres d’analyse invalides." });
  }
  try {
    const [homeEvents, awayEvents] = await Promise.all([
      getSchedule(sport, league, home),
      getSchedule(sport, league, away)
    ]);
    const parseTeam = (events, id) => events
      .filter(completed)
      .map(event => normalize(event, id))
      .filter(Boolean)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const homeMatches = parseTeam(homeEvents, home);
    const awayMatches = parseTeam(awayEvents, away);
    const homeRecent = homeMatches.slice(0, Number(limit));
    const awayRecent = awayMatches.slice(0, Number(limit));
    const awayIds = new Set([String(away)]);
    const h2h = homeMatches
      .filter(match => awayIds.has(match.opponentId))
      .slice(0, 5);
    const summarize = matches => {
      const totals = matches.reduce((acc, match) => {
        acc[match.result] += 1;
        acc.goalsFor += match.goalsFor;
        acc.goalsAgainst += match.goalsAgainst;
        if (match.goalsAgainst === 0) acc.cleanSheets += 1;
        return acc;
      }, { W: 0, D: 0, L: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 });
      const count = matches.length;
      return {
        matches: count,
        wins: totals.W,
        draws: totals.D,
        losses: totals.L,
        goalsFor: totals.goalsFor,
        goalsAgainst: totals.goalsAgainst,
        averageGoalsFor: count ? Number((totals.goalsFor / count).toFixed(2)) : null,
        averageGoalsAgainst: count ? Number((totals.goalsAgainst / count).toFixed(2)) : null,
        cleanSheets: totals.cleanSheets,
        form: matches.map(match => match.result).join("")
      };
    };
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      source: "ESPN team schedules",
      fetchedAt: new Date().toISOString(),
      requestedMatches: Number(limit),
      teams: {
        home: { stats: summarize(homeRecent), recent: homeRecent },
        away: { stats: summarize(awayRecent), recent: awayRecent }
      },
      headToHead: { count: h2h.length, matches: h2h }
    });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error: "L’historique des équipes n’a pas pu être récupéré auprès d’ESPN.",
      detail: error?.message || "Erreur inconnue"
    });
  }
}
