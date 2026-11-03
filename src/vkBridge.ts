import bridge from "@vkontakte/vk-bridge";

export const vkRequestTimeout = 5000;

let initializationPromise: Promise<boolean> | null = null;

export function isVkEnvironment(search = window.location.search): boolean {
  const params = new URLSearchParams(search);
  const platform = params.get("vk_platform");

  if (params.has("vk_app_id") || params.has("vk_user_id") || platform !== null) {
    return true;
  }

  try {
    return bridge.isWebView() || bridge.isIframe();
  } catch (error) {
    console.warn(
      "[VK] Не удалось определить среду запуска. Используется локальный режим.",
      error instanceof Error ? error.name : "Unknown error",
    );
    return false;
  }
}

export function withVkTimeout<T>(request: Promise<T>, method: string): Promise<T> {
  let timeoutId: number;
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
    console.info("[VK] Начинается инициализация VK Bridge.");
    try {
      initializationPromise = withVkTimeout(
        bridge.send("VKWebAppInit"),
        "VKWebAppInit",
      ).then(
        () => {
          console.info("[VK] VK Bridge успешно инициализирован.");
          return true;
        },
        (error: unknown) => {
          console.error(
            "[VK] Ошибка инициализации VK Bridge. Продолжаем в локальном режиме.",
            error instanceof Error ? error.name : "Unknown error",
          );
          return false;
        },
      );
    } catch (error) {
      console.error(
        "[VK] Ошибка инициализации VK Bridge. Продолжаем в локальном режиме.",
        error instanceof Error ? error.name : "Unknown error",
      );
      initializationPromise = Promise.resolve(false);
    }
  }

  return initializationPromise;
}
