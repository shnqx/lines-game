import { describe, expect, it } from "vitest";
import { countCrossings, segmentsIntersect, type Edge, type Point } from "./geometry";
import { generateLevel } from "./generateLevel";

describe("segmentsIntersect", () => {
  it("detects proper crossings but excludes touching and collinear segments", () => {
    expect(segmentsIntersect(
      { x: 0, y: 0 }, { x: 1, y: 1 },
      { x: 0, y: 1 }, { x: 1, y: 0 },
    )).toBe(true);
    expect(segmentsIntersect(
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 1, y: 0 }, { x: 1, y: 1 },
    )).toBe(false);
    expect(segmentsIntersect(
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0.25, y: 0 }, { x: 0.75, y: 0 },
    )).toBe(false);
  });

  it("does not count edges that share a node", () => {
    const edges: Edge[] = [
      { id: "a", from: 0, to: 1 },
      { id: "b", from: 0, to: 2 },
    ];
    const positions: Point[] = [
      { x: 0.5, y: 0.5 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(countCrossings(edges, positions)).toBe(0);
  });
});

describe("generateLevel", () => {
  it("creates deterministic, solvable levels with a shuffled starting state", () => {
    for (const levelIndex of [1, 5, 15, 40]) {
      const level = generateLevel(levelIndex);
      expect(countCrossings(level.edges, level.solutionLayout)).toBe(0);
      expect(countCrossings(level.edges, level.initialLayout)).toBeGreaterThan(0);
      expect(generateLevel(levelIndex)).toEqual(level);
    }
  });

  it("keeps all shuffled nodes on the solution positions", () => {
    const level = generateLevel(7);
    const positions = new Set(level.solutionLayout.map(({ x, y }) => `${x},${y}`));
    expect(level.initialLayout.every(({ x, y }) => positions.has(`${x},${y}`))).toBe(true);
  });
});
