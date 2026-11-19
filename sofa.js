// Vercel Serverless Function — Sofascore proxy for handball endpoints.
export default async function handler(req, res) {
  const raw = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
  const allowed = /^\/?(sport\/handball\/(scheduled-events\/[0-9]{4}-[0-9]{2}-[0-9]{2}|teams\/all)|team\/[0-9]+\/events\/last\/0|event\/[0-9]+)$/;
  if (!raw || typeof raw !== "string" || raw.length > 250 || !allowed.test(raw)) {
    return res.status(400).json({ error: "Invalid Sofascore path" });
  }
  try {
    const upstream = await fetch("https://www.sofascore.com/api/v1/" + raw.replace(/^\/+/, ""), {
      headers: { "User-Agent": "Mozilla/5.0 SportsTracker/1.0", "Accept": "application/json" }
    });
    const body = await upstream.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
    return res.status(upstream.status).send(body);
  } catch (err) {
    return res.status(502).json({ error: "Sofascore upstream unavailable" });
  }
}
