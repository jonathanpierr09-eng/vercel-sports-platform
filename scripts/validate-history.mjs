import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { count: teamCount, error: teamError } = await db
  .from("teams").select("*", { count: "exact", head: true }).eq("sport", "soccer");
if (teamError) throw new Error(`teams query failed: ${teamError.message}`);

const { count: matchCount, error: matchError } = await db
  .from("matches").select("*", { count: "exact", head: true }).eq("sport", "soccer");
if (matchError) throw new Error(`matches query failed: ${matchError.message}`);

const { data: rows, error: sampleError } = await db
  .from("matches")
  .select("event_id,league,season,kickoff,home_goals,away_goals,stats")
  .eq("sport", "soccer")
  .order("kickoff", { ascending: false })
  .limit(1000);
if (sampleError) throw new Error(`sample query failed: ${sampleError.message}`);

const missingScores = (rows || []).filter(row =>
  row.home_goals === null || row.away_goals === null
).length;
const missingStats = (rows || []).filter(row =>
  !row.stats || Object.keys(row.stats).length === 0
).length;
const leagues = [...new Set((rows || []).map(row => row.league))].sort();
const seasons = [...new Set((rows || []).map(row => row.season))].sort();

const report = {
  checkedAt: new Date().toISOString(),
  teamsTotal: teamCount ?? 0,
  matchesTotal: matchCount ?? 0,
  sampleSize: rows?.length ?? 0,
  leaguesInSample: leagues,
  seasonsInSample: seasons,
  sampleRowsMissingScores: missingScores,
  sampleRowsWithoutOptionalStats: missingStats,
  note: "Missing optional source statistics are reported, never fabricated. Sample metrics cover the latest 1,000 matches."
};
console.log(JSON.stringify(report, null, 2));
if (!matchCount) process.exitCode = 1;
