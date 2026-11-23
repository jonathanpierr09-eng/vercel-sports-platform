import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHeadToHead,
  buildTeamHistory,
  normalizeTeamEvent,
  scoreValue,
  summarizeMatches
} from "../lib/historical-analysis.js";

function event(id, date, homeId, awayId, homeScore, awayScore, state = "post") {
  return {
    id: String(id),
    date,
    competitions: [{
      status: { type: { completed: state === "post", state } },
      competitors: [
        { homeAway: "home", team: { id: String(homeId), displayName: `Team ${homeId}` }, score: homeScore },
        { homeAway: "away", team: { id: String(awayId), displayName: `Team ${awayId}` }, score: awayScore }
      ]
    }]
  };
}

test("scoreValue accepts numeric and ESPN display values, rejects missing/negative", () => {
  assert.equal(scoreValue(2), 2);
  assert.equal(scoreValue(" 3 "), 3);
  assert.equal(scoreValue({ displayValue: "4" }), 4);
  assert.equal(scoreValue("—"), null);
  assert.equal(scoreValue(-1), null);
  assert.equal(scoreValue(null), null);
});

test("normalizeTeamEvent ignores unfinished and malformed score events", () => {
  assert.equal(normalizeTeamEvent(event(1, "2026-01-01T12:00:00Z", 1, 2, "1", "0", "in"), 1), null);
  assert.equal(normalizeTeamEvent(event(2, "2026-01-01T12:00:00Z", 1, 2, "—", "0"), 1), null);
});

test("history contains only completed matches strictly before target kickoff", () => {
  const rows = [
    event(1, "2026-01-01T12:00:00Z", 1, 2, "2", "0"),
    event(2, "2026-01-02T12:00:00Z", 1, 3, "1", "1"),
    event(3, "2026-01-03T12:00:00Z", 1, 4, "0", "1"),
    event(4, "2026-01-04T12:00:00Z", 1, 5, "4", "0", "in")
  ];
  const result = buildTeamHistory(rows, 1, { before: "2026-01-03T12:00:00Z", limit: 10 });
  assert.deepEqual(result.all.map(row => row.id), ["2", "1"]);
  assert.equal(result.recent.length, 2);
});

test("summary keeps empty averages null and computes totals", () => {
  const empty = summarizeMatches([]);
  assert.equal(empty.matches, 0);
  assert.equal(empty.averageGoalsFor, null);
  const rows = buildTeamHistory([
    event(1, "2026-01-01T12:00:00Z", 1, 2, "2", "0"),
    event(2, "2026-01-02T12:00:00Z", 1, 3, "1", "1")
  ], 1).recent;
  const stats = summarizeMatches(rows);
  assert.equal(stats.matches, 2);
  assert.equal(stats.wins, 1);
  assert.equal(stats.draws, 1);
  assert.equal(stats.goalsFor, 3);
  assert.equal(stats.goalsAgainst, 1);
  assert.equal(stats.form, "DW");
});

test("head-to-head is symmetric to schedule ordering and respects target date", () => {
  const rows = [
    event(1, "2026-01-01T12:00:00Z", 1, 2, "2", "0"),
    event(2, "2026-02-01T12:00:00Z", 2, 1, "1", "1"),
    event(3, "2026-03-01T12:00:00Z", 1, 2, "0", "3")
  ];
  const h2h = buildHeadToHead(rows, 1, 2, { before: "2026-03-01T12:00:00Z" });
  assert.deepEqual(h2h.map(row => row.id), ["2", "1"]);
  assert.equal(h2h[0].result, "D");
});
