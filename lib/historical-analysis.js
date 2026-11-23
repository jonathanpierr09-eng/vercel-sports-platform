// Pure historical analysis helpers. No future fixture forecasting.
export function scoreValue(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
    return match ? Number(match[1]) : null;
  }
  if (value && typeof value === "object") return scoreValue(value.displayValue ?? value.value);
  return null;
}

export function isCompletedEvent(event) {
  const status = event?.competitions?.[0]?.status?.type;
  return status?.completed === true || status?.state === "post";
}

function validKickoff(event) {
  const timestamp = Date.parse(event?.date || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function normalizeTeamEvent(event, teamId) {
  if (!isCompletedEvent(event)) return null;
  const competitors = event?.competitions?.[0]?.competitors || [];
  const own = competitors.find(item => String(item?.team?.id ?? item?.id) === String(teamId));
  const other = competitors.find(item => item !== own);
  const kickoff = validKickoff(event);
  if (!event?.id || !own || !other || kickoff === null) return null;

  const goalsFor = scoreValue(own.score);
  const goalsAgainst = scoreValue(other.score);
  if (goalsFor === null || goalsAgainst === null) return null;
  const opponentId = other?.team?.id ?? other?.id;
  if (opponentId === undefined || opponentId === null) return null;

  return {
    id: String(event.id),
    date: new Date(kickoff).toISOString(),
    opponent: other.team?.displayName || other.team?.name || "Adversaire",
    opponentId: String(opponentId),
    homeAway: own.homeAway === "home" || own.homeAway === "away" ? own.homeAway : null,
    goalsFor,
    goalsAgainst,
    result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
    competition: event.name || event.shortName || null
  };
}

export function buildTeamHistory(events, teamId, { before = null, limit = 10 } = {}) {
  const cutoff = before === null ? null : Date.parse(before);
  if (before !== null && !Number.isFinite(cutoff)) throw new TypeError("Invalid target date");
  const unique = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!isCompletedEvent(event)) continue;
    const match = normalizeTeamEvent(event, teamId);
    if (!match || (cutoff !== null && Date.parse(match.date) >= cutoff)) continue;
    unique.set(match.id, match);
  }
  const all = [...unique.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { all, recent: all.slice(0, limit) };
}

export function summarizeMatches(matches) {
  const rows = Array.isArray(matches) ? matches : [];
  const totals = rows.reduce((acc, match) => {
    acc[match.result] += 1;
    acc.goalsFor += match.goalsFor;
    acc.goalsAgainst += match.goalsAgainst;
    if (match.goalsAgainst === 0) acc.cleanSheets += 1;
    return acc;
  }, { W: 0, D: 0, L: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 });
  const count = rows.length;
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
    form: rows.map(match => match.result).join("")
  };
}

export function buildHeadToHead(homeEvents, homeId, awayId, { before = null, limit = 5 } = {}) {
  return buildTeamHistory(homeEvents, homeId, { before, limit: Number.MAX_SAFE_INTEGER })
    .all.filter(match => match.opponentId === String(awayId))
    .slice(0, limit);
}
