import bridge from "@vkontakte/vk-bridge";

export const vkRequestTimeout = 5000;

let initializationPromise: Promise<boolean> | null = null;
const storageReadPromises = new Map<string, Promise<string | null>>();

function getLaunchParams(search: string, hash: string): URLSearchParams[] {
  return [search, hash].map((part) => {
    const queryStart = part.indexOf("?");
    const query = queryStart >= 0 ? part.slice(queryStart + 1) : part.replace(/^#/, "");
    return new URLSearchParams(query);
  });
}

function hasVkLaunchParams(search: string, hash: string): boolean {
  return getLaunchParams(search, hash).some((params) =>
    ["vk_app_id", "vk_user_id", "vk_platform", "sign"].some((key) => params.has(key)),
  );
}

export function isVkEnvironment(
  search = typeof window === "undefined" ? "" : window.location.search,
  hash = typeof window === "undefined" ? "" : window.location.hash,
): boolean {
  if (hasVkLaunchParams(search, hash)) return true;

  if (typeof window !== "undefined") {
    try {
      if (window.self !== window.top) return true;
    } catch {
      // Cross-origin frame access can fail; continue with the bridge checks.
    }
  }

  try {
    if (bridge.isIframe()) return true;
  } catch {
    // The bridge environment helpers may be unavailable in a regular browser.
  }

  try {
    if (bridge.isWebView()) return true;
  } catch {
    // The bridge environment helpers may be unavailable in a regular browser.
  }

  if (typeof window !== "undefined") {
    return /(?:VKAndroidApp|VKApp|VKWebView)/i.test(window.navigator.userAgent);
  }

  return false;
}

export function getVkBridgeInitialization(): Promise<boolean> {
  return initializationPromise ?? Promise.resolve(false);
}

export function getVkUserId(
  search = typeof window === "undefined" ? "" : window.location.search,
  hash = typeof window === "undefined" ? "" : window.location.hash,
): string | null {
  for (const params of getLaunchParams(search, hash)) {
    const userId = params.get("vk_user_id");
    if (userId) return userId;
  }
  return null;
}

export function withVkTimeout<T>(request: Promise<T>, method: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${method} timed out`)),
      vkRequestTimeout,
    );
  });

  return Promise.race([request, timeout]).finally(() => clearTimeout(timeoutId));
}

export function initializeVkBridge(): Promise<boolean> {
  if (!initializationPromise) {
    console.info("[VK DEBUG] Starting VK Bridge initialization.");
    try {
      console.info("[VK DEBUG] Sending VKWebAppInit.");
      initializationPromise = withVkTimeout(
        Promise.resolve().then(() => bridge.send("VKWebAppInit")),
        "VKWebAppInit",
      ).then(
        () => {
          console.info("[VK DEBUG] VK Bridge initialized successfully.");
          return true;
        },
        (error: unknown) => {
          console.error(
            "[VK DEBUG] VK Bridge initialization failed; continuing without VK.",
            error instanceof Error ? error.name : "Unknown error",
          );
          return false;
        },
      );
    } catch (error) {
      console.error(
        "[VK DEBUG] VK Bridge initialization failed; continuing without VK.",
        error instanceof Error ? error.name : "Unknown error",
      );
      initializationPromise = Promise.resolve(false);
    }
  }

  return initializationPromise;
}

export function getVkStorageValue(key: string): Promise<string | null> {
  const existingRequest = storageReadPromises.get(key);
  if (existingRequest) return existingRequest;

  console.info("[VK DEBUG] Starting VK Storage read.");
  const request = withVkTimeout(
      Promise.resolve().then(() => bridge.send("VKWebAppStorageGet", { keys: [key] })),
      "VKWebAppStorageGet",
    ).then((response) => {
      console.info("[VK DEBUG] VK Storage responded.");
      return response.keys.find((item) => item.key === key)?.value ?? null;
    }).catch((error: unknown) => {
      console.error(
        "[VK DEBUG] VK Storage read failed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      throw error;
    });
  storageReadPromises.set(key, request);
  return request;
}

export function setVkStorageValue(key: string, value: string): Promise<void> {
  console.info("[VK DEBUG] Starting VK Storage write.");
  return withVkTimeout(
      Promise.resolve().then(() => bridge.send("VKWebAppStorageSet", { key, value })),
      "VKWebAppStorageSet",
    ).then(() => {
      console.info("[VK DEBUG] VK Storage write completed.");
    }).catch((error: unknown) => {
      console.error(
        "[VK DEBUG] VK Storage write failed.",
        error instanceof Error ? error.name : "Unknown error",
      );
      throw error;
    });
}
