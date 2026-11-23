import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMatchHistory } from "../lib/match-engine.js";

const row = (goalsFor, goalsAgainst, result, homeAway = "home") =>
  ({ goalsFor, goalsAgainst, result, homeAway });

test("produces deterministic historical report", () => {
  const input = {
    home: { recent: [row(2, 0, "W"), row(1, 1, "D"), row(2, 1, "W")] },
    away: { recent: [row(0, 1, "L", "away"), row(2, 2, "D", "away")] },
    headToHead: { matches: [row(1, 0, "W"), row(0, 0, "D")] }
  };
  const first = analyzeMatchHistory(input);
  const second = analyzeMatchHistory(input);
  assert.equal(first.text, second.text);
  assert.equal(first.home.stats.matches, 3);
  assert.match(first.text, /Scores exacts les plus fréquents dans les archives/);
  assert.match(first.text, /PAS DES SCORES PRÉVUS/);
});

test("ignores malformed score rows and marks low coverage", () => {
  const report = analyzeMatchHistory({
    home: { recent: [row("?", 0, "W"), row(1, 0, "W")] },
    away: { recent: [] },
    headToHead: { matches: [] }
  });
  assert.equal(report.home.stats.matches, 1);
  assert.equal(report.coverage.sufficient, false);
  assert.match(report.text, /Couverture limitée/);
});

test("score frequency is counted from historical rows only", () => {
  const report = analyzeMatchHistory({
    home: { recent: [row(2, 1, "W"), row(2, 1, "W"), row(0, 0, "D")] },
    away: { recent: [] }
  });
  assert.deepEqual(report.home.historicalScores[0], { score: "2-1", count: 2 });
});


test("uses team names and explains limited samples without future forecasts", () => {
  const report = analyzeMatchHistory({
    home: { name: "Monza", recent: [row(1, 2, "L")] },
    away: { name: "Fiorentina", recent: [row(2, 2, "D", "away")] },
    headToHead: { matches: [] }
  });
  assert.match(report.text, /Monza/);
  assert.match(report.text, /Fiorentina/);
  assert.match(report.text, /Échantillon limité/);
  assert.match(report.text, /Aucun tirage aléatoire/);
});

test("does not count negative or missing scores", () => {
  const report = analyzeMatchHistory({
    home: { recent: [row(-1, 0, "L"), row(2, 0, "W")] },
    away: { recent: [] }
  });
  assert.equal(report.home.stats.matches, 1);
});
