import { describe, expect, it, vi } from "vitest";
import { hintCost, initialProgress, parseProgress, rewardForLevel } from "./economy";

describe("player economy", () => {
  it("uses a small, predictable hint price and grows level rewards gradually", () => {
    expect(hintCost).toBe(5);
    expect(rewardForLevel(1)).toBe(8);
    expect(rewardForLevel(5)).toBe(9);
    expect(rewardForLevel(10)).toBe(10);
  });

  it("loads valid progress and safely rejects invalid saves", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(parseProgress('{"coins":12,"unlockedLevel":4}')).toEqual({
      coins: 12,
      unlockedLevel: 4,
    });
    expect(parseProgress('{"coins":-1,"unlockedLevel":0}')).toEqual(initialProgress);
    expect(parseProgress("not json")).toEqual(initialProgress);
    expect(parseProgress(null)).toEqual(initialProgress);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
