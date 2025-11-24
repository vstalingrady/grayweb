
import { useMemo, useCallback, useState, useEffect, type CSSProperties } from "react";
import { CheckSquare, Square, Zap, Trash2, ChevronDown, Clock, Edit3, MessageCircle, LayoutDashboard, History, Search, ChevronsRight, LifeBuoy, LogOut, Monitor, Moon, Palette, Plus, Settings, Sun, X } from "lucide-react";
import styles from "./GrayDashboard.module.css";


export type PulseChecklistItem = {
  id: string;
  text: string;
  complete?: boolean;
  note?: string;
  streakId?: string;
};

export type PulseChecklistGroupKey = "plans" | "habits";

export type PulseChecklistGroup = {
  key: PulseChecklistGroupKey;
  title: string;
  addLabel: string;
  items: PulseChecklistItem[];
};

export type PulseProactivityEntry = {
  id: string;
  name: string;
  description?: string;
  cadence: string;
  time: string;
  active: boolean;
};

export type PulseStreak = {
  id: string;
  label: string;
  count: number;
  updatedToday: boolean;
  groupKey: PulseChecklistGroupKey;
  description?: string;
};

export type PulseStreakHistoryRecord = {
  entryId: string;
  entryLabel: string;
  entryDateShort: string;
  count: number;
  order: number;
};

export type PulseStatus = "steady" | "focus" | "blocked";

export type PulseEntry = {
  id: string;
  tabLabel: string;
  dayLabel: string;
  dateLabel: string;
  dateShort: string;
  status: PulseStatus;
  headline: string;
  summary: string;
  highlights: string[];
  checklistGroups: PulseChecklistGroup[];
  proactivity: PulseProactivityEntry[];
  streaks: PulseStreak[];
};

export const proactivityCadenceOptions = ["Daily", "Weekdays", "Weekly", "Monthly", "Paused"] as const;

export const pulseGroupTabs: ReadonlyArray<{ key: PulseChecklistGroupKey; label: string }> = [
  { key: "plans", label: "Plans" },
  { key: "habits", label: "Habits" }
] as const;

type PulseCardProps = {
  entry: PulseEntry;
  isInteractive?: boolean;
  onToggleItem?: (entryId: string, groupKey: PulseChecklistGroupKey, itemId: string) => void;
  onRemoveItem?: (entryId: string, groupKey: PulseChecklistGroupKey, itemId: string) => void;
  onEditItem?: (
    entryId: string,
    groupKey: PulseChecklistGroupKey,
    itemId: string,
    currentText: string
  ) => void;
  onAddItem?: (entryId: string, groupKey: PulseChecklistGroupKey) => void;
  onToggleProactivity?: (entryId: string, proactivityId: string) => void;
  onAddProactivity?: (entryId: string, data: { name: string; cadence: string; time: string }) => void;
  onUpdateProactivity?: (
    entryId: string,
    proactivityId: string,
    updates: Partial<PulseProactivityEntry>
  ) => void;
  onRemoveProactivity?: (entryId: string, proactivityId: string) => void;
  showProactivity?: boolean;
  showStreaks?: boolean;
  visibleGroupKey?: PulseChecklistGroupKey | "all";
  streakHistoryMap?: Map<string, PulseStreakHistoryRecord[]>;
  entryOrderMap?: Map<string, number>;
  withContainer?: boolean;
};

function PulseCard({
  entry,
  isInteractive = true,
  onToggleItem,
  onRemoveItem,
  onEditItem,
  onAddItem,
  onToggleProactivity,
  onAddProactivity,
  onUpdateProactivity,
  onRemoveProactivity,
  showProactivity = true,
  showStreaks: _showStreaks = false,
  visibleGroupKey = "all",
  streakHistoryMap,
  entryOrderMap,
  withContainer = true
}: PulseCardProps) {
  void _showStreaks;
  const checklistGroups = useMemo(
    () =>
      visibleGroupKey === "all"
        ? entry.checklistGroups
        : entry.checklistGroups.filter((group) => group.key === visibleGroupKey),
    [entry, visibleGroupKey]
  );
  const streakMap = useMemo(() => {
    const map = new Map<string, PulseStreak>();
    entry.streaks.forEach((streak) => {
      map.set(streak.id, streak);
    });
    return map;
  }, [entry.streaks]);
  const entryOrder = entryOrderMap?.get(entry.id) ?? 0;
  const handleToggleItem = (groupKey: PulseChecklistGroupKey, itemId: string) => {
    if (!isInteractive) {
      return;
    }
    onToggleItem?.(entry.id, groupKey, itemId);
  };

  const handleRemoveItem = (groupKey: PulseChecklistGroupKey, itemId: string) => {
    if (!isInteractive) {
      return;
    }
    onRemoveItem?.(entry.id, groupKey, itemId);
  };

  const handleEditItem = (groupKey: PulseChecklistGroupKey, item: PulseChecklistItem) => {
    if (!isInteractive) {
      return;
    }
    onEditItem?.(entry.id, groupKey, item.id, item.text);
  };

  const handleAddItem = (groupKey: PulseChecklistGroupKey) => {
    if (!isInteractive) {
      return;
    }
    onAddItem?.(entry.id, groupKey);
  };

  const [isAddingProactivity, setIsAddingProactivity] = useState(false);
  const [newProactivityName, setNewProactivityName] = useState("");
  const [newProactivityCadence, setNewProactivityCadence] = useState<string>(proactivityCadenceOptions[0]);
  const [newProactivityTime, setNewProactivityTime] = useState("09:00");

  const handleToggleProactivityEntry = (proactivityId: string) => {
    if (!isInteractive || !onToggleProactivity) {
      return;
    }
    onToggleProactivity?.(entry.id, proactivityId);
  };

  const handleUpdateProactivity = (
    proactivityId: string,
    updates: Partial<PulseProactivityEntry>
  ) => {
    if (!isInteractive || !onUpdateProactivity) {
      return;
    }
    onUpdateProactivity?.(entry.id, proactivityId, updates);
  };

  const handleRemoveProactivity = (proactivityId: string) => {
    if (!isInteractive || !onRemoveProactivity) {
      return;
    }
    onRemoveProactivity?.(entry.id, proactivityId);
  };

  const resetProactivityForm = () => {
    setNewProactivityName("");
    setNewProactivityCadence(proactivityCadenceOptions[0]);
    setNewProactivityTime("09:00");
  };

  const handleStartProactivity = () => {
    if (!isInteractive || !onAddProactivity) {
      return;
    }
    setIsAddingProactivity(true);
  };

  const handleCancelProactivity = () => {
    resetProactivityForm();
    setIsAddingProactivity(false);
  };

  const handleSubmitProactivity = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isInteractive || !onAddProactivity) {
      return;
    }
    const trimmedName = newProactivityName.trim();
    if (!trimmedName) {
      return;
    }

    onAddProactivity(entry.id, {
      name: trimmedName,
      cadence: newProactivityCadence,
      time: newProactivityTime
    });

    resetProactivityForm();
    setIsAddingProactivity(false);
  };

  const cardContent = (
    <>
      <div className={styles["gray-pulse__grid"]}>
        {checklistGroups.map((group) => (
          <section key={group.key} className={styles["gray-pulse__column"]} aria-label={group.title}>
            <header className={styles["gray-pulse__column-header"]}>
              <h4>{group.title}</h4>
            </header>
            <ul className={styles["gray-pulse__list"]}>
              {group.items.map((item) => {
                const checkboxClasses = [styles["gray-pulse__checkbox"], styles[`gray-pulse__checkbox--${group.key}`]]
                  .filter(Boolean)
                  .join(" ");
                const hasStreak = group.key === "habits" && Boolean(item.streakId);
                const streakId = item.streakId ?? "";
                const currentStreak = hasStreak ? streakMap.get(streakId) : undefined;
                const currentStreakCount = currentStreak?.count ?? 0;
                const currentStreakLabel = `${currentStreakCount} day${currentStreakCount === 1 ? "" : "s"}`;
                const streakHistoryRecords = hasStreak ? streakHistoryMap?.get(streakId) ?? [] : [];
                const previousStreaks = hasStreak
                  ? streakHistoryRecords
                    .filter((record) => record.entryId !== entry.id && record.order > entryOrder)
                    .sort((a, b) => a.order - b.order)
                  : [];
                const previousSummary =
                  hasStreak && previousStreaks.length > 0
                    ? `Prev: ${previousStreaks
                      .slice(0, 3)
                      .map(
                        (record) =>
                          `${record.entryLabel} — ${record.count} day${record.count === 1 ? "" : "s"}`
                      )
                      .join(" • ")}`
                    : "";
                const streakPill = hasStreak ? (
                  <span className={`${styles["gray-pulse__streak-pill"]} ${styles[`gray-pulse__streak-pill--${group.key}`]}`}>
                    <Zap size={14} strokeWidth={1.5} aria-hidden="true" />
                    <span>{currentStreakLabel}</span>
                  </span>
                ) : null;

                return (
                  <li key={item.id} className={`${styles["gray-pulse__list-item"]} ${item.complete ? styles["is-complete"] : ""}`}>
                    <label className={styles["gray-pulse__list-label"]}>
                      <span className={checkboxClasses}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.complete)}
                          onChange={() => handleToggleItem(group.key, item.id)}
                          disabled={!isInteractive}
                          aria-label={`${group.title} item ${item.text}`}
                        />
                        <span className={styles["gray-pulse__checkbox-indicator"]} aria-hidden />
                      </span>
                      <span className={styles["gray-pulse__list-text"]}>
                        <span className={styles["gray-pulse__list-line"]}>
                          <span className={styles["gray-pulse__list-line-text"]}>{item.text}</span>
                        </span>
                        {previousSummary ? (
                          <span className={styles["gray-pulse__streak-history"]}>{previousSummary}</span>
                        ) : null}
                        {item.note ? <span className={styles["gray-pulse__list-note"]}>{item.note}</span> : null}
                      </span>
                    </label>
                    {(streakPill || isInteractive) && (
                      <div className={styles["gray-pulse__list-trailing"]}>
                        {streakPill}
                        {isInteractive ? (
                          <div className={styles["gray-pulse__list-actions"]}>
                            <button
                              type="button"
                              className={styles["gray-pulse__list-action"]}
                              onClick={() => handleEditItem(group.key, item)}
                              aria-label={`Edit ${group.title} item ${item.text}`}
                            >
                              <Edit3 size={16} strokeWidth={1.7} />
                            </button>
                            <button
                              type="button"
                              className={`${styles["gray-pulse__list-action"]} ${styles["gray-pulse__list-action--remove"]}`}
                              onClick={() => handleRemoveItem(group.key, item.id)}
                              aria-label={`Remove ${group.title} item ${item.text}`}
                            >
                              <Trash2 size={16} strokeWidth={1.7} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className={styles["gray-pulse__add-button"]}
              onClick={() => handleAddItem(group.key)}
              disabled={!isInteractive}
            >
              {group.addLabel}
            </button>
          </section>
        ))}
        {showProactivity ? (
          <section className={`${styles["gray-pulse__column"]} ${styles["gray-pulse__column--proactivity"]}`} aria-label="Proactivity">
            <header className={styles["gray-pulse__column-header"]}>
              <h4>Proactivity</h4>
            </header>
            <div className={styles["gray-pulse__proactivity-list"]}>
              {entry.proactivity.length === 0 ? (
                <p className={styles["gray-pulse__empty"]}>No proactivity nudges yet.</p>
              ) : null}
              {entry.proactivity.map((proactivity) => (
                <article key={proactivity.id} className={styles["gray-pulse__proactivity-entry"]}>
                  <div className={styles["gray-pulse__proactivity-header"]}>
                    <label className={styles["gray-pulse__toggle"]}>
                      <span className={`${styles["gray-pulse__checkbox"]} ${styles["gray-pulse__checkbox--proactivity"]}`}>
                        <input
                          type="checkbox"
                          checked={proactivity.active}
                          onChange={() => handleToggleProactivityEntry(proactivity.id)}
                          disabled={!isInteractive}
                          aria-label={`Toggle ${proactivity.name}`}
                        />
                        <span className={styles["gray-pulse__checkbox-indicator"]} aria-hidden />
                      </span>
                      <span className={styles["gray-pulse__toggle-copy"]}>
                        <span className={styles["gray-pulse__toggle-title"]}>{proactivity.name}</span>
                        {proactivity.description ? (
                          <span className={styles["gray-pulse__toggle-description"]}>{proactivity.description}</span>
                        ) : null}
                      </span>
                    </label>
                    {isInteractive ? (
                      <button
                        type="button"
                        className={`${styles["gray-pulse__icon-button"]} ${styles["gray-pulse__icon-button--danger"]}`}
                        onClick={() => handleRemoveProactivity(proactivity.id)}
                        aria-label={`Remove ${proactivity.name}`}
                      >
                        <Trash2 size={16} strokeWidth={1.7} />
                      </button>
                    ) : null}
                  </div>
                  <div className={styles["gray-pulse__proactivity-controls"]}>
                    <label className={styles["gray-pulse__field"]}>
                      <span className={styles["gray-pulse__field-label"]}>Cadence</span>
                      <select
                        className={styles["gray-pulse__field-input"]}
                        value={proactivity.cadence}
                        onChange={(event) =>
                          handleUpdateProactivity(proactivity.id, { cadence: event.target.value })
                        }
                        disabled={!isInteractive}
                      >
                        {proactivityCadenceOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles["gray-pulse__field"]}>
                      <span className={styles["gray-pulse__field-label"]}>Time</span>
                      <input
                        type="time"
                        className={styles["gray-pulse__field-input"]}
                        value={proactivity.time}
                        onChange={(event) =>
                          handleUpdateProactivity(proactivity.id, { time: event.target.value })
                        }
                        disabled={!isInteractive}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
            {isInteractive && onAddProactivity ? (
              isAddingProactivity ? (
                <form className={styles["gray-pulse__proactivity-form"]} onSubmit={handleSubmitProactivity}>
                  <div className={styles["gray-pulse__proactivity-form-fields"]}>
                    <label className={styles["gray-pulse__field"]}>
                      <span className={styles["gray-pulse__field-label"]}>Name</span>
                      <input
                        type="text"
                        className={styles["gray-pulse__field-input"]}
                        value={newProactivityName}
                        onChange={(event) => setNewProactivityName(event.target.value)}
                        placeholder="Standup reminder"
                        autoFocus
                      />
                    </label>
                    <label className={styles["gray-pulse__field"]}>
                      <span className={styles["gray-pulse__field-label"]}>Cadence</span>
                      <select
                        className={styles["gray-pulse__field-input"]}
                        value={newProactivityCadence}
                        onChange={(event) => setNewProactivityCadence(event.target.value)}
                      >
                        {proactivityCadenceOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles["gray-pulse__field"]}>
                      <span className={styles["gray-pulse__field-label"]}>Time</span>
                      <input
                        type="time"
                        className={styles["gray-pulse__field-input"]}
                        value={newProactivityTime}
                        onChange={(event) => setNewProactivityTime(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className={styles["gray-pulse__proactivity-form-actions"]}>
                    <button type="submit" className={styles["gray-pulse__add-button"]}>
                      Save proactivity
                    </button>
                    <button
                      type="button"
                      className={styles["gray-pulse__tag-button"]}
                      onClick={handleCancelProactivity}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className={styles["gray-pulse__add-button"]} onClick={handleStartProactivity}>
                  Add proactivity
                </button>
              )
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );

  return withContainer ? <div className={styles["gray-pulse__card"]}>{cardContent}</div> : cardContent;
}


