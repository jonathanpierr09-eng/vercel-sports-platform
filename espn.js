// Vercel Serverless Function — ESPN public API proxy.
// The client passes the ESPN path (including its query string) in ?path=...
export default async function handler(req, res) {
  const raw = typeof req.query.path === "string" ? req.query.path : "";
  if (!raw || raw.length > 700 || raw.startsWith("/") || raw.includes("..")) {
    return res.status(400).json({ error: "Invalid ESPN path" });
  }
  const split = raw.split("?");
  const route = split[0];
  const allowed = /^(soccer|basketball|hockey)\/[a-z0-9._-]+\/(scoreboard|teams\/[0-9]+\/schedule|summary)$/i;
  if (!allowed.test(route)) {
    return res.status(400).json({ error: "ESPN endpoint not allowed" });
  }
  const target = new URL(route, "https://site.api.espn.com/apis/site/v2/sports/");
  if (split[1]) {
    const params = new URLSearchParams(split.slice(1).join("?"));
    for (const key of ["dates", "season", "event"]) {
      const value = params.get(key);
      if (value && /^[0-9-]{1,20}$/.test(value)) target.searchParams.set(key, value);
    }
  }
  try {
    const upstream = await fetch(target.toString(), {
      headers: { "User-Agent": "SportsTracker/1.0", "Accept": "application/json" }
    });
    const body = await upstream.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
    return res.status(upstream.status).send(body);
  } catch (err) {
    return res.status(502).json({ error: "ESPN upstream unavailable" });
  }
}
