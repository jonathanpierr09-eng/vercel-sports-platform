const SPORTS = new Set(["soccer", "basketball", "hockey"]);
const LEAGUE = /^[a-z0-9._-]{1,40}$/i;
const TEAM_ID = /^\d{1,12}$/;
const DATE_RANGE = /^\d{8}(?:-\d{8})?$/;

function jsonError(res, status, error) {
  return res.status(status).json({ error });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return jsonError(res, 405, "Method not allowed");
  }

  const raw = typeof req.query?.path === "string" ? req.query.path : "";
  if (!raw || raw.length > 500 || raw.startsWith("/") || raw.includes("..") || raw.includes("#")) {
    return jsonError(res, 400, "Invalid ESPN path");
  }

  const question = raw.indexOf("?");
  const route = question === -1 ? raw : raw.slice(0, question);
  const query = question === -1 ? "" : raw.slice(question + 1);
  const parts = route.split("/");
  if (parts.length < 3 || !SPORTS.has(parts[0]) || !LEAGUE.test(parts[1])) {
    return jsonError(res, 400, "ESPN endpoint not allowed");
  }

  const [sport, league, resource, fourth, fifth] = parts;
  const isScoreboard = parts.length === 3 && resource === "scoreboard";
  const isSummary = parts.length === 3 && resource === "summary";
  const isTeamSchedule =
    parts.length === 5 && resource === "teams" && TEAM_ID.test(fourth) && fifth === "schedule";

  if (!isScoreboard && !isSummary && !isTeamSchedule) {
    return jsonError(res, 400, "ESPN endpoint not allowed");
  }

  const params = new URLSearchParams(query);
  const allowedParams = new Set(["dates", "event", "season", "limit"]);
  for (const key of params.keys()) {
    if (!allowedParams.has(key) || params.getAll(key).length !== 1) {
      return jsonError(res, 400, "Invalid ESPN query parameter");
    }
  }

  const target = new URL(
    `${sport}/${league}/${resource}${isTeamSchedule ? `/${fourth}/schedule` : ""}`,
    "https://site.api.espn.com/apis/site/v2/sports/"
  );

  const dates = params.get("dates");
  if (dates !== null) {
    if (!DATE_RANGE.test(dates)) return jsonError(res, 400, "Invalid dates parameter");
    target.searchParams.set("dates", dates);
  }

  const event = params.get("event");
  if (event !== null) {
    if (!/^\d{1,20}$/.test(event)) return jsonError(res, 400, "Invalid event parameter");
    target.searchParams.set("event", event);
  }

  const season = params.get("season");
  if (season !== null) {
    if (!/^\d{4}$/.test(season)) return jsonError(res, 400, "Invalid season parameter");
    target.searchParams.set("season", season);
  }

  const limit = params.get("limit");
  if (limit !== null) {
    if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 200) {
      return jsonError(res, 400, "Invalid limit parameter");
    }
    target.searchParams.set("limit", limit);
  }

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "PRONO/1.1",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(8000)
    });

    const body = await upstream.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(upstream.status).send(body);
  } catch {
    return jsonError(res, 502, "ESPN upstream unavailable");
  }
}
