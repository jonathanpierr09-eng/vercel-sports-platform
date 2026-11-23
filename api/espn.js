export default async function handler(req, res) {
  const raw = typeof req.query.path === "string" ? req.query.path : "";
  if (!raw || raw.length > 500 || raw.startsWith("/") || raw.includes("..")) return res.status(400).json({error:"Invalid ESPN path"});
  const [route, query=""] = raw.split("?");
  const allowed = /^(soccer|basketball|hockey)\/[a-z0-9._-]+\/scoreboard$/i;
  if (!allowed.test(route)) return res.status(400).json({error:"ESPN endpoint not allowed"});
  const target = new URL(route, "https://site.api.espn.com/apis/site/v2/sports/");
  const params = new URLSearchParams(query);
  const dates = params.get("dates");
  if (dates && /^\d{8}(-\d{8})?$/.test(dates)) target.searchParams.set("dates", dates);
  try {
    const upstream = await fetch(target.toString(), {headers:{"User-Agent":"PRONO/1.0","Accept":"application/json"}});
    const body = await upstream.text();
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","s-maxage=5, stale-while-revalidate=5");
    return res.status(upstream.status).send(body);
  } catch { return res.status(502).json({error:"ESPN upstream unavailable"}); }
}