import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const SPORT = "soccer";
const LEAGUES = [
  { id: "eng.1", name: "Premier League" },
  { id: "esp.1", name: "La Liga" },
  { id: "ger.1", name: "Bundesliga" },
  { id: "ita.1", name: "Serie A" },
  { id: "fra.1", name: "Ligue 1" }
];
const SEASONS = [
  { year: "2023", dates: "20230801-20240531" },
  { year: "2024", dates: "20240801-20250531" },
  { year: "2025", dates: "20250801-20260531" }
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function espnJson(path) {
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}`, {
    headers: { Accept: "application/json", "User-Agent": "PRONO-Historical-Ingest/1.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`ESPN HTTP ${response.status} for ${path}`);
  return response.json();
}

function integerScore(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function completedEvent(event) {
  const status = event?.competitions?.[0]?.status?.type;
  return status?.completed === true || status?.state === "post";
}

function normalizeEvent(event, league, season) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find(item => item.homeAway === "home");
  const away = competitors.find(item => item.homeAway === "away");
  if (!home?.team?.id || !away?.team?.id || !event?.id || !event?.date) return null;

  const homeGoals = integerScore(home.score);
  const awayGoals = integerScore(away.score);
  if (homeGoals === null || awayGoals === null) return null;

  const homeId = Number(home.team.id);
  const awayId = Number(away.team.id);
  if (!Number.isSafeInteger(homeId) || !Number.isSafeInteger(awayId) || homeId === awayId) return null;

  return {
    event_id: String(event.id),
    sport: SPORT,
    league: league.id,
    season,
    kickoff: new Date(event.date).toISOString(),
    home_team: homeId,
    away_team: awayId,
    home_goals: homeGoals,
    away_goals: awayGoals,
    status: "post",
    stats: {}
  };
}

async function upsertInChunks(table, rows, onConflict, chunkSize = 250) {
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const { error } = await db.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
  }
}

let total = 0;
for (const league of LEAGUES) {
  for (const season of SEASONS) {
    const path = `${SPORT}/${league.id}/scoreboard?dates=${season.dates}&limit=200`;
    console.log(`Fetching ${league.name} ${season.year}...`);
    const data = await espnJson(path);
    const events = Array.isArray(data.events) ? data.events : [];
    const matches = events
      .filter(completedEvent)
      .map(event => normalizeEvent(event, league, season.year))
      .filter(Boolean);

    const teamsById = new Map();
    for (const event of events) {
      for (const competitor of event?.competitions?.[0]?.competitors || []) {
        const id = Number(competitor?.team?.id);
        const name = competitor?.team?.displayName || competitor?.team?.name;
        if (Number.isSafeInteger(id) && name) {
          teamsById.set(id, {
            sport: SPORT,
            id,
            league: league.id,
            name: String(name),
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    const teams = [...teamsById.values()];
    await upsertInChunks("teams", teams, "sport,id");
    await upsertInChunks("matches", matches, "event_id");
    total += matches.length;
    console.log(`  ${events.length} events; ${teams.length} teams; ${matches.length} completed matches stored.`);
    await sleep(350);
  }
}
console.log(`Historical ingestion finished. ${total} completed matches processed (idempotent upsert).`);
