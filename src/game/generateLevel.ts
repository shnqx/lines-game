import { countCrossings, type Edge, type Point } from "./geometry";
import { paramsForLevel } from "./difficultyCurve";

export interface LevelGraph {
  levelIndex: number;
  edges: Edge[];
  initialLayout: Point[];
  solutionLayout: Point[];
  targetCrossings: number;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIndices(length: number, random: () => number): number[] {
  const indices = Array.from({ length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }
  return indices;
}

export function generateLevel(levelIndex: number, seed = levelIndex): LevelGraph {
  const params = paramsForLevel(levelIndex);
  const { nodeCount } = params;
  const solutionLayout = Array.from({ length: nodeCount }, (_, index) => {
    const angle = (index / nodeCount) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 0.5 + Math.cos(angle) * 0.38,
      y: 0.5 + Math.sin(angle) * 0.38,
    };
  });

  const edges: Edge[] = [];
  for (let index = 0; index < nodeCount; index += 1) {
    edges.push({
      id: `ring-${index}`,
      from: index,
      to: (index + 1) % nodeCount,
    });
  }
  for (let index = 2; index < nodeCount - 1; index += 1) {
    edges.push({ id: `spoke-${index}`, from: 0, to: index });
  }

  const random = createRandom(seed);
  let bestLayout = solutionLayout;
  let bestDistance = Number.POSITIVE_INFINITY;
  const attempts = 300;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const permutation = shuffledIndices(nodeCount, random);
    const candidate = permutation.map((positionIndex) => solutionLayout[positionIndex]);
    const crossings = countCrossings(edges, candidate);
    if (crossings === 0) continue;

    const distance = Math.abs(crossings - params.targetCrossings);
    if (distance < bestDistance) {
      bestLayout = candidate;
      bestDistance = distance;
    }
    if (distance === 0) break;
  }

  if (bestDistance === Number.POSITIVE_INFINITY) {
    for (let first = 0; first < nodeCount && bestDistance === Number.POSITIVE_INFINITY; first += 1) {
      for (let second = first + 1; second < nodeCount; second += 1) {
        const candidate = [...solutionLayout];
        [candidate[first], candidate[second]] = [candidate[second], candidate[first]];
        if (countCrossings(edges, candidate) > 0) {
          bestLayout = candidate;
          bestDistance = 0;
          break;
        }
      }
    }

    if (bestDistance === Number.POSITIVE_INFINITY) {
      throw new Error(`Unable to scramble level ${levelIndex} without losing solvability.`);
    }
  }

  return {
    levelIndex: Math.max(1, Math.floor(levelIndex)),
    edges,
    initialLayout: bestLayout.map((point) => ({ ...point })),
    solutionLayout,
    targetCrossings: params.targetCrossings,
  };
}
