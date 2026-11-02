export interface DifficultyParams {
  nodeCount: number;
  targetCrossings: number;
}

export function paramsForLevel(levelIndex: number): DifficultyParams {
  const level = Math.max(1, Math.floor(levelIndex));
  const progress = Math.log2(level + 1);

  return {
    nodeCount: Math.min(30, 6 + Math.floor(progress * 2.5)),
    targetCrossings: Math.max(2, Math.floor(progress * 2.2)),
  };
}
