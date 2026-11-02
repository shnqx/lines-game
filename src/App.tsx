import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import bridge from "@vkontakte/vk-bridge";
import { countCrossings, getCrossingEdgeIds, type Point } from "./game/geometry";
import { generateLevel } from "./game/generateLevel";
import {
  hintCost,
  initialProgress,
  parseProgress,
  rewardedAdCoins,
  rewardForLevel,
  type PlayerProgress,
} from "./game/economy";

const viewWidth = 1000;
const viewHeight = 680;
const progressKey = "rasputay-niti-progress";

function readLocalProgress(): { progress: PlayerProgress; warning: string | null } {
  try {
    return {
      progress: parseProgress(window.localStorage.getItem(progressKey)),
      warning: null,
    };
  } catch (error) {
    console.error("Не удалось прочитать локальное сохранение.", error);
    return {
      progress: initialProgress,
      warning: "Не удалось загрузить сохранение на этом устройстве.",
    };
  }
}

function App() {
  const [isVkApp] = useState(() => bridge.isWebView());
  const [localSave] = useState(readLocalProgress);
  const [progress, setProgress] = useState(localSave.progress);
  const [progressLoaded, setProgressLoaded] = useState(!isVkApp);
  const [storageWarning, setStorageWarning] = useState(localSave.warning);
  const [notice, setNotice] = useState("");
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [levelIndex, setLevelIndex] = useState(localSave.progress.unlockedLevel);
  const level = useMemo(() => generateLevel(levelIndex), [levelIndex]);
  const [positions, setPositions] = useState<Point[]>(level.initialLayout);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const rewardedLevel = useRef<number | null>(null);
  const crossings = countCrossings(level.edges, positions);
  const crossingEdges = getCrossingEdgeIds(level.edges, positions);
  const solved = crossings === 0;
  const canUseHint = progress.coins >= hintCost;
  const crossingLabel =
    crossings % 10 === 1 && crossings % 100 !== 11
      ? "пересечение"
      : crossings % 10 >= 2 && crossings % 10 <= 4 && (crossings % 100 < 12 || crossings % 100 > 14)
        ? "пересечения"
        : "пересечений";

  useEffect(() => {
    if (!isVkApp) return;

    let cancelled = false;
    const loadVkProgress = async () => {
      try {
        await bridge.send("VKWebAppInit");
        const response = await bridge.send("VKWebAppStorageGet", { keys: [progressKey] });
        const savedValue = response.keys.find((item) => item.key === progressKey)?.value;
        if (!cancelled && savedValue) {
          const savedProgress = parseProgress(savedValue);
          setProgress(savedProgress);
          setLevelIndex(savedProgress.unlockedLevel);
          setPositions(generateLevel(savedProgress.unlockedLevel).initialLayout);
        }
      } catch (error) {
        console.error("Не удалось синхронизировать прогресс VK.", error);
        if (!cancelled) {
          setStorageWarning("Прогресс VK недоступен. Игра продолжится с сохранением устройства.");
        }
      } finally {
        if (!cancelled) setProgressLoaded(true);
      }
    };

    void loadVkProgress();
    return () => {
      cancelled = true;
    };
  }, [isVkApp]);

  useEffect(() => {
    if (!progressLoaded) return;

    try {
      window.localStorage.setItem(progressKey, JSON.stringify(progress));
      setStorageWarning(null);
    } catch (error) {
      console.error("Не удалось сохранить прогресс на устройстве.", error);
      setStorageWarning("Не удалось сохранить прогресс на этом устройстве.");
    }

    if (isVkApp) {
      void bridge
        .send("VKWebAppStorageSet", { key: progressKey, value: JSON.stringify(progress) })
        .then(() => setStorageWarning(null))
        .catch((error: unknown) => {
          console.error("Не удалось записать прогресс в VK.", error);
          setStorageWarning("Не удалось синхронизировать прогресс с VK.");
        });
    }
  }, [isVkApp, progress, progressLoaded]);

  useEffect(() => {
    if (!progressLoaded || !solved || rewardedLevel.current === levelIndex) return;
    rewardedLevel.current = levelIndex;
    if (levelIndex < progress.unlockedLevel) return;

    const reward = rewardForLevel(levelIndex);
    setProgress((current) => ({
      coins: current.coins + reward,
      unlockedLevel: Math.max(current.unlockedLevel, levelIndex + 1),
    }));
    setNotice(`Уровень пройден — +${reward} ✦`);
  }, [levelIndex, progress.unlockedLevel, progressLoaded, solved]);

  const restartLevel = () => {
    setPositions(level.initialLayout.map((point) => ({ ...point })));
    setMoves(0);
    setActiveNode(null);
    setNotice("");
  };

  const startNextLevel = () => {
    const nextLevelIndex = levelIndex + 1;
    setLevelIndex(nextLevelIndex);
    setPositions(generateLevel(nextLevelIndex).initialLayout);
    setMoves(0);
    setActiveNode(null);
    setNotice("");
  };

  const moveNode = (event: PointerEvent<SVGSVGElement>) => {
    if (activeNode === null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextPoint = {
      x: Math.max(0.06, Math.min(0.94, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0.08, Math.min(0.92, (event.clientY - bounds.top) / bounds.height)),
    };
    setPositions((current) =>
      current.map((point, index) => (index === activeNode ? nextPoint : point)),
    );
  };

  const finishMove = () => {
    if (activeNode !== null) {
      setMoves((current) => current + 1);
      setActiveNode(null);
    }
  };

  const moveHintNode = () => {
    if (crossingEdges.size === 0) return false;
    const edgeCounts = new Map<number, number>();
    for (const edge of level.edges) {
      if (!crossingEdges.has(edge.id)) continue;
      edgeCounts.set(edge.from, (edgeCounts.get(edge.from) ?? 0) + 1);
      edgeCounts.set(edge.to, (edgeCounts.get(edge.to) ?? 0) + 1);
    }
    const suggestedNode = [...edgeCounts.entries()]
      .filter(([node]) => {
        const current = positions[node];
        const solution = level.solutionLayout[node];
        return current.x !== solution.x || current.y !== solution.y;
      })
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (suggestedNode !== undefined) {
      setPositions((current) =>
        current.map((point, index) =>
          index === suggestedNode ? level.solutionLayout[index] : point,
        ),
      );
      setMoves((current) => current + 1);
      return true;
    }
    return false;
  };

  const useHint = () => {
    if (!canUseHint) {
      setNotice("Не хватает монет: решите уровень или посмотрите видео в VK.");
      return;
    }
    if (moveHintNode()) {
      setProgress((current) => ({ ...current, coins: current.coins - hintCost }));
      setNotice(`Подсказка использована: −${hintCost} ✦`);
    }
  };

  const watchRewardedAd = async () => {
    if (!isVkApp || isWatchingAd) return;

    setIsWatchingAd(true);
    setNotice("");
    try {
      const availability = await bridge.send("VKWebAppCheckNativeAds", { ad_format: "reward" });
      if (!availability.result) {
        setNotice("Сейчас нет доступного видео. Попробуйте позже.");
        return;
      }

      await bridge.send("VKWebAppShowNativeAds", { ad_format: "reward" });
      setProgress((current) => ({ ...current, coins: current.coins + rewardedAdCoins }));
      setNotice(`За просмотр начислено +${rewardedAdCoins} ✦`);
    } catch (error) {
      console.error("Не удалось показать rewarded-рекламу VK.", error);
      setNotice("Не удалось запустить видео. Монеты не начислены.");
    } finally {
      setIsWatchingAd(false);
    }
  };

  if (!progressLoaded) {
    return <main className="app-shell loading-screen">Загружаем прогресс…</main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Распутай нити — главная">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>распутай нити</span>
        </a>
        <div className="topbar-note"><span className="status-dot" /> тихая головоломка</div>
        <div className="currency-balance" aria-label={`Монеты: ${progress.coins}`}>✦ {progress.coins}</div>
        <button className="icon-button" type="button" aria-label="О проекте" title="О проекте">
          <span>?</span>
        </button>
      </header>

      <section className="game-layout" aria-label="Игровой уровень">
        <div className="intro">
          <div className="eyebrow">ПРОСТРАНСТВО ДЛЯ МЫСЛЕЙ</div>
          <h1>Распутай<br /><em>нити.</em></h1>
          <p>Передвигай узлы, пока линии<br className="desktop-break" /> не перестанут пересекаться.</p>
        </div>

        <section className={`puzzle-card${solved ? " is-solved" : ""}`}>
          <div className="puzzle-topline">
            <div className="level-label"><span>УРОВЕНЬ</span><strong>{String(levelIndex).padStart(2, "0")}</strong></div>
            <div className={`crossing-count${crossings === 0 ? " clear" : ""}`}>
              <span className="crossing-indicator" />
              {crossings === 0 ? "всё чисто" : `${crossings} ${crossingLabel}`}
            </div>
          </div>

          <svg
            className="puzzle-board"
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            preserveAspectRatio="none"
            aria-label="Поле с узлами и пересекающимися нитями"
            onPointerMove={moveNode}
            onPointerUp={finishMove}
            onPointerCancel={finishMove}
          >
            <defs>
              <filter id="soft-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="9" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {level.edges.map((edge, index) => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              const crossed = crossingEdges.has(edge.id);
              return (
                <line
                  key={edge.id}
                  x1={from.x * viewWidth}
                  y1={from.y * viewHeight}
                  x2={to.x * viewWidth}
                  y2={to.y * viewHeight}
                  className={`thread thread-${index % 3}${crossed ? " crossed" : ""}`}
                  filter={crossed ? "url(#soft-glow)" : undefined}
                />
              );
            })}
            {positions.map((point, index) => (
              <g
                key={index}
                className={`node${activeNode === index ? " dragging" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`Узел ${index + 1}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setActiveNode(index);
                }}
                onKeyDown={(event) => {
                  const deltas: Record<string, Point> = {
                    ArrowUp: { x: 0, y: -0.015 },
                    ArrowDown: { x: 0, y: 0.015 },
                    ArrowLeft: { x: -0.015, y: 0 },
                    ArrowRight: { x: 0.015, y: 0 },
                  };
                  const delta = deltas[event.key];
                  if (!delta) return;
                  event.preventDefault();
                  setPositions((current) =>
                    current.map((position, nodeIndex) =>
                      nodeIndex === index
                        ? {
                            x: Math.max(0.06, Math.min(0.94, position.x + delta.x)),
                            y: Math.max(0.08, Math.min(0.92, position.y + delta.y)),
                          }
                        : position,
                    ),
                  );
                  setMoves((current) => current + 1);
                }}
              >
                <circle cx={point.x * viewWidth} cy={point.y * viewHeight} r="25" className="node-hit" />
                <circle cx={point.x * viewWidth} cy={point.y * viewHeight} r="11" className="node-shadow" />
                <circle cx={point.x * viewWidth} cy={point.y * viewHeight} r="8" className="node-core" />
                <circle cx={point.x * viewWidth - 2} cy={point.y * viewHeight - 2} r="2" className="node-shine" />
              </g>
            ))}
          </svg>

          <div className="board-hint"><span className="mouse-icon" /> зажми и перемещай узлы</div>
          {solved && (
            <div className="win-message" role="status">
              <span className="win-sparkle">✳</span>
              <div><strong>Красиво распутано.</strong><span>Все нити на своих местах.</span></div>
            </div>
          )}
        </section>

        <div className="controls">
          <div className="move-counter"><span>ХОДЫ</span><strong>{String(moves).padStart(2, "0")}</strong></div>
          <div className="control-actions">
            <button type="button" className="text-button" onClick={restartLevel}>Начать сначала</button>
            <button type="button" className="hint-button" onClick={useHint} disabled={solved}>
              <span className="hint-icon">✳</span> Подсказка · {hintCost} ✦
            </button>
            {isVkApp && (
              <button
                type="button"
                className="ad-button"
                onClick={watchRewardedAd}
                disabled={solved || isWatchingAd}
              >
                {isWatchingAd ? "Загрузка…" : `Видео · +${rewardedAdCoins} ✦`}
              </button>
            )}
            {solved && <button type="button" className="next-button" onClick={startNextLevel}>Дальше <span>↗</span></button>}
          </div>
        </div>

        {(notice || storageWarning) && (
          <div className={`game-notice${storageWarning ? " is-warning" : ""}`} role="status">
            {storageWarning || notice}
          </div>
        )}

        <div className="progress-track" aria-label={`Уровень ${levelIndex}`}>
          <span style={{ width: `${Math.min(100, 8 + levelIndex * 3)}%` }} />
        </div>
      </section>

      <footer className="footer">
        <span>ПЕРЕДЫШКА В РИТМЕ ДНЯ</span>
        <span>{level.edges.length} нитей <i /> {positions.length} узлов</span>
      </footer>
    </main>
  );
}

export default App;
