import test from "node:test";
import assert from "node:assert/strict";
import { placeTrendLabels } from "../src/content/dashboard/trend-labels.js";

test("nearby colored series labels stay on their correct side", () => {
  const points = [
    { key: "Facebook", x: 235, y: 156, width: 34 },
    { key: "Google", x: 235, y: 118, width: 34 },
    { key: "Tiktok", x: 235, y: 167, width: 34 },
  ];
  const positions = placeTrendLabels(points, 350, 298);
  assert.ok(positions.get("Facebook").y < 156);
  assert.ok(positions.get("Tiktok").y > 167);
  assert.ok(positions.get("Google").y < positions.get("Facebook").y);
});

test("dense groups omit labels that cannot fit without crossing neighboring points", () => {
  const points = [90, 94, 98, 102].map(y => ({ key: y, x: 160, y, width: 36 }));
  points.push({ key: "older", x: 148, y: 90, width: 36 });
  const positions = placeTrendLabels(points, 180, 160);
  assert.deepEqual([...positions.keys()], [90, 102]);
});
