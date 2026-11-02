export interface PlayerProgress {
  coins: number;
  unlockedLevel: number;
}

export const initialProgress: PlayerProgress = {
  coins: 0,
  unlockedLevel: 1,
};

export const hintCost = 5;
export const rewardedAdCoins = 5;

export function rewardForLevel(levelIndex: number): number {
  return 8 + Math.floor(Math.max(1, levelIndex) / 5);
}

export function parseProgress(value: string | null): PlayerProgress {
  if (!value) return initialProgress;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("coins" in parsed) ||
      !("unlockedLevel" in parsed) ||
      typeof parsed.coins !== "number" ||
      !Number.isSafeInteger(parsed.coins) ||
      parsed.coins < 0 ||
      typeof parsed.unlockedLevel !== "number" ||
      !Number.isSafeInteger(parsed.unlockedLevel) ||
      parsed.unlockedLevel < 1
    ) {
      return initialProgress;
    }

    return {
      coins: parsed.coins,
      unlockedLevel: parsed.unlockedLevel,
    };
  } catch (error) {
    console.error("Не удалось прочитать сохранение игры.", error);
    return initialProgress;
  }
}
