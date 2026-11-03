import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, isWebViewMock, isIframeMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  isWebViewMock: vi.fn(),
  isIframeMock: vi.fn(),
}));

vi.mock("@vkontakte/vk-bridge", () => ({
  default: {
    send: sendMock,
    isWebView: isWebViewMock,
    isIframe: isIframeMock,
  },
}));

import {
  getVkUserId,
  initializeVkBridge,
  isVkEnvironment,
  withVkTimeout,
} from "./vkBridge";

describe("VK Bridge startup", () => {
  beforeEach(() => {
    sendMock.mockReset();
    isWebViewMock.mockReset().mockReturnValue(false);
    isIframeMock.mockReset().mockReturnValue(false);
    vi.useRealTimers();
  });

  it("recognizes VK launch parameters without relying on WebView detection", () => {
    expect(isVkEnvironment("?vk_app_id=123&vk_platform=mobile_android")).toBe(true);
    expect(isVkEnvironment("?vk_platform=desktop_web")).toBe(true);
    expect(isWebViewMock).not.toHaveBeenCalled();
  });

  it("does not detect VK in a regular browser", () => {
    expect(isVkEnvironment("")).toBe(false);
  });

  it("recognizes desktop VK when it runs in an iframe without launch parameters", () => {
    isIframeMock.mockReturnValue(true);

    expect(isVkEnvironment("")).toBe(true);
    expect(isIframeMock).toHaveBeenCalledOnce();
  });

  it("recognizes launch parameters in a route hash without modifying the URL", () => {
    expect(isVkEnvironment("", "#/level?vk_platform=desktop_web")).toBe(true);
    expect(getVkUserId("", "#/level?vk_user_id=456")).toBe("456");
    expect(getVkUserId("?vk_app_id=123")).toBeNull();
  });

  it("initializes the bridge only once for repeated callers", async () => {
    sendMock.mockResolvedValue(undefined);

    await expect(Promise.all([initializeVkBridge(), initializeVkBridge()])).resolves.toEqual([
      true,
      true,
    ]);
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith("VKWebAppInit");
  });

  it("falls back locally when VK initialization fails", async () => {
    vi.resetModules();
    sendMock.mockRejectedValueOnce(new Error("Bridge unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { initializeVkBridge: initializeAfterFailure } = await import("./vkBridge");

    await expect(initializeAfterFailure()).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("rejects bridge requests that do not respond before the timeout", async () => {
    vi.useFakeTimers();
    const request = withVkTimeout(new Promise<never>(() => undefined), "VKWebAppStorageGet");
    const rejection = expect(request).rejects.toThrow("VKWebAppStorageGet timed out");

    await vi.advanceTimersByTimeAsync(5000);
    await rejection;
  });

  it("shares the same VK Storage read for repeated callers", async () => {
    vi.resetModules();
    sendMock.mockResolvedValueOnce({ keys: [{ key: "progress", value: "saved" }] });
    const { getVkStorageValue: getStorageValue } = await import("./vkBridge");

    await expect(Promise.all([
      getStorageValue("progress"),
      getStorageValue("progress"),
    ])).resolves.toEqual(["saved", "saved"]);
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith("VKWebAppStorageGet", { keys: ["progress"] });
  });
});
