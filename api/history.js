// Historical ESPN analysis endpoint. Only completed matches before the selected fixture are included.
import { buildHeadToHead, buildTeamHistory, summarizeMatches } from "../lib/historical-analysis.js";

const SPORTS = new Set(["soccer", "basketball", "hockey"]);
const LEAGUE_RE = /^[a-z0-9._-]{2,40}$/i;
const TEAM_RE = /^\d{1,12}$/;

async function getSchedule(sport, league, teamId) {
  const url = new URL(
    "https://site.api.espn.com/apis/site/v2/sports/" +
    sport + "/" + league + "/teams/" + teamId + "/schedule"
  );
  const response = await fetch(url, {
    headers: { "User-Agent": "PRONO/1.2", "Accept": "application/json" },
    signal: AbortSignal.timeout(7500)
  });
  if (!response.ok) throw new Error("ESPN HTTP " + response.status);
  const data = await response.json();
  if (!Array.isArray(data.events)) throw new Error("Format d’historique ESPN non reconnu");
  return data.events;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  const { sport, league, home, away, limit = "10", targetDate } = req.query || {};
  if (!SPORTS.has(sport) || !LEAGUE_RE.test(league || "") ||
      !TEAM_RE.test(home || "") || !TEAM_RE.test(away || "") ||
      home === away || !["5", "10"].includes(String(limit))) {
    return res.status(400).json({ error: "Paramètres d’analyse invalides." });
  }
  if (targetDate !== undefined &&
      (typeof targetDate !== "string" || !Number.isFinite(Date.parse(targetDate)))) {
    return res.status(400).json({ error: "Date de rencontre invalide." });
  }

  try {
    const [homeEvents, awayEvents] = await Promise.all([
      getSchedule(sport, league, home),
      getSchedule(sport, league, away)
    ]);
    const cutoff = targetDate || null;
    const homeHistory = buildTeamHistory(homeEvents, home, { before: cutoff, limit: Number(limit) });
    const awayHistory = buildTeamHistory(awayEvents, away, { before: cutoff, limit: Number(limit) });
    const h2h = buildHeadToHead(homeEvents, home, away, { before: cutoff, limit: 5 });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      source: "ESPN team schedules",
      fetchedAt: new Date().toISOString(),
      targetDate: cutoff,
      requestedMatches: Number(limit),
      teams: {
        home: { stats: summarizeMatches(homeHistory.recent), recent: homeHistory.recent, available: homeHistory.all.length },
        away: { stats: summarizeMatches(awayHistory.recent), recent: awayHistory.recent, available: awayHistory.all.length }
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
