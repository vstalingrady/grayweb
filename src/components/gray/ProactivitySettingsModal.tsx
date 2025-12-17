/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Pencil, X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { type ProactivityItem } from "./types";
import {
    CUSTOM_PROACTIVITY_ID,
    DEFAULT_CUSTOM_SETTINGS,
    DEFAULT_PROACTIVITY_TIME,
    PROACTIVITY_PRESETS,
    type CustomSettingsState,
    buildCustomProactivityItem,
    dedupeTimes,
    findNextCustomTime,
    formatCustomTimeLabel,
    normalizeTimeForInput,
} from "./proactivityUtils";

export type ProactivitySettingsModalProps = {
    isOpen: boolean;
    onClose: () => void;
    activeProactivity?: ProactivityItem | null;
    activeProactivityTimes: string[];
    onSelectProactivity: (next: ProactivityItem) => void;
    onRemoveProactivity?: () => void;
    onProactivityTimeRemove?: (index: number) => void;
    showRemoveButton?: boolean;
};

export function ProactivitySettingsModal({
    isOpen,
    onClose,
    activeProactivity,
    activeProactivityTimes,
    onSelectProactivity,
    onRemoveProactivity,
    showRemoveButton = false,
}: ProactivitySettingsModalProps) {
    const { t } = useI18n();
    const activeProactivityId = activeProactivity?.id;
    const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
        if (activeProactivityId && PROACTIVITY_PRESETS.some((preset) => preset.id === activeProactivityId)) {
            return activeProactivityId;
        }
        if (activeProactivityId === CUSTOM_PROACTIVITY_ID) {
            return CUSTOM_PROACTIVITY_ID;
        }
        return "";
    });

    const [customSettings, setCustomSettings] = useState<CustomSettingsState>(() => ({
        times: activeProactivityTimes.length > 0 ? activeProactivityTimes : [...DEFAULT_CUSTOM_SETTINGS.times],
    }));

    const [editingCustomTimeIndex, setEditingCustomTimeIndex] = useState<number | null>(null);
    const [editingCustomTimeDraft, setEditingCustomTimeDraft] = useState<string>("");

    const customTimes = customSettings.times;
    const isCustomPresetSelected = selectedPresetId === CUSTOM_PROACTIVITY_ID;

    // Effect to sync state when opening modal
    useEffect(() => {
        if (!isOpen) return;

        setCustomSettings({
            times: activeProactivityTimes.length > 0 ? activeProactivityTimes : [...DEFAULT_CUSTOM_SETTINGS.times],
        });

        if (activeProactivityId === CUSTOM_PROACTIVITY_ID) {
            setSelectedPresetId(CUSTOM_PROACTIVITY_ID);
        } else if (activeProactivityId && PROACTIVITY_PRESETS.some((preset) => preset.id === activeProactivityId)) {
            setSelectedPresetId(activeProactivityId);
        } else {
            setSelectedPresetId("");
        }
    }, [isOpen, activeProactivityId, activeProactivityTimes]);

    // Effect to handle escape key and reset edit state
    useEffect(() => {
        if (!isOpen) {
            setEditingCustomTimeIndex(null);
            setEditingCustomTimeDraft("");
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const applyCustomProactivity = useCallback(
        (nextTimes: string[]) => {
            onSelectProactivity(buildCustomProactivityItem(nextTimes));
        },
        [onSelectProactivity]
    );

    const handleCustomReset = useCallback(() => {
        setCustomSettings({
            times: activeProactivityTimes.length > 0 ? activeProactivityTimes : [...DEFAULT_CUSTOM_SETTINGS.times],
        });
        setEditingCustomTimeIndex(null);
        setEditingCustomTimeDraft("");
    }, [activeProactivityTimes]);

    const commitCustomTimeEdit = useCallback(
        (index: number, draftValue: string) => {
            setCustomSettings((prev) => {
                const nextTimes = [...prev.times];
                const previousValue = nextTimes[index] ?? DEFAULT_PROACTIVITY_TIME;
                const normalized = normalizeTimeForInput(draftValue || previousValue);
                nextTimes[index] = normalized;
                return { ...prev, times: dedupeTimes(nextTimes) };
            });
            setEditingCustomTimeIndex(null);
            setEditingCustomTimeDraft("");

            const baseTimes = customTimes;
            const previousValue = baseTimes[index] ?? DEFAULT_PROACTIVITY_TIME;
            const normalized = normalizeTimeForInput(draftValue || previousValue);
            const nextTimes = [...baseTimes];
            nextTimes[index] = normalized;
            applyCustomProactivity(dedupeTimes(nextTimes));
        },
        [applyCustomProactivity, customTimes]
    );

    const handleCustomTimeEdit = useCallback((index: number) => {
        setEditingCustomTimeIndex(index);
        setEditingCustomTimeDraft(customTimes[index] ?? DEFAULT_PROACTIVITY_TIME);
    }, [customTimes]);

    const handleCustomTimeAdd = useCallback(() => {
        const nextTime = findNextCustomTime(customTimes);
        setCustomSettings((prev) => ({ ...prev, times: [...prev.times, nextTime] }));
        const nextTimes = [...customTimes, nextTime];
        setEditingCustomTimeIndex(nextTimes.length - 1);
        setEditingCustomTimeDraft(nextTime);
        applyCustomProactivity(nextTimes);
    }, [applyCustomProactivity, customTimes]);

    const handleCustomTimeRemove = useCallback(
        (index: number) => {
            setCustomSettings((prev) => {
                if (prev.times.length <= 1) return prev;
                const nextTimes = prev.times.filter((_, currentIndex) => currentIndex !== index);
                return { ...prev, times: nextTimes.length > 0 ? nextTimes : [...DEFAULT_CUSTOM_SETTINGS.times] };
            });
            setEditingCustomTimeIndex(null);
            setEditingCustomTimeDraft("");

            const nextTimes = customTimes.filter((_, currentIndex) => currentIndex !== index);
            const finalTimes = nextTimes.length > 0 ? nextTimes : [...DEFAULT_CUSTOM_SETTINGS.times];
            applyCustomProactivity(finalTimes);
        },
        [applyCustomProactivity, customTimes]
    );

    const handleCustomTimeChange = useCallback((value: string) => {
        setEditingCustomTimeDraft(value);
    }, []);

    const handlePresetSelectChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            const nextPresetId = event.target.value;
            setSelectedPresetId(nextPresetId);

            if (!nextPresetId || nextPresetId === CUSTOM_PROACTIVITY_ID) return;

            const preset = PROACTIVITY_PRESETS.find((option) => option.id === nextPresetId);
            if (preset) {
                const presetTimes =
                    preset.defaultTimes && preset.defaultTimes.length > 0
                        ? dedupeTimes(preset.defaultTimes)
                        : dedupeTimes([preset.defaultTime ?? DEFAULT_PROACTIVITY_TIME]);
                const primaryTime = presetTimes[0] ?? DEFAULT_PROACTIVITY_TIME;

                onSelectProactivity({
                    id: preset.id,
                    label: preset.label,
                    description: preset.description,
                    cadence: preset.cadence,
                    time: primaryTime,
                    times: presetTimes,
                });
                onClose();
            }
        },
        [onClose, onSelectProactivity]
    );

    const modalRemoveLabel = activeProactivity ? t("Remove proactivity") : t("Skip for now");
    // The consumer passes showRemoveButton if onRemoveProactivity is present and we have something to remove

    const content = (
        <div
            className={styles.proactivityModalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="proactivityModalHeading"
        >
            <div className={styles.proactivityModal}>
                <header className={styles.proactivityModalHeader}>
                    <div className={styles.proactivityModalHeading}>
                        <span className={styles.proactivityModalEyebrow} id="proactivityModalHeading">
                            {t("Proactivity")}
                        </span>
                    </div>
                    <button
                        type="button"
                        className={styles.proactivityModalClose}
                        onClick={onClose}
                        aria-label={t("Close proactivity options")}
                    >
                        <X size={16} />
                    </button>
                </header>
                <label
                    id="proactivityPresetLabel"
                    htmlFor="proactivityPresetSelect"
                    className={styles.proactivityPresetLabel}
                >
                    {t("Preset cadence")}
                </label>
                <div className={styles.proactivityPresetSelectWrapper}>
                    <select
                        id="proactivityPresetSelect"
                        className={styles.proactivityPresetSelect}
                        value={selectedPresetId}
                        onChange={handlePresetSelectChange}
                    >
                        <option value="">{t("Select a preset")}</option>
                        {PROACTIVITY_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                                {t(preset.title)}
                            </option>
                        ))}
                        <option value={CUSTOM_PROACTIVITY_ID}>{t("Custom")}</option>
                    </select>
                    <ChevronDown size={14} className={styles.proactivityPresetSelectIcon} aria-hidden="true" />
                </div>
                {isCustomPresetSelected ? (
                    <section className={styles.proactivityCustomSection}>
                        <header className={styles.proactivityCustomHeader}>
                            <div>
                                <span className={styles.proactivityCustomEyebrow}>{t("Custom setup")}</span>
                            </div>
                            <button
                                type="button"
                                className={styles.proactivityCustomReset}
                                onClick={handleCustomReset}
                            >
                                {t("Reset")}
                            </button>
                        </header>
                        <div className={styles.proactivityCustomControls}>
                            <div className={styles.proactivityCustomField}>
                                <div className={styles.proactivityTimes}>
                                    {customTimes.map((time, index) => (
                                        <div key={`${time}-${index}`} className={styles.proactivityTimeListItem}>
                                            {editingCustomTimeIndex === index ? (
                                                <input
                                                    type="time"
                                                    value={editingCustomTimeDraft}
                                                    onChange={(event) => handleCustomTimeChange(event.target.value)}
                                                    className={styles.proactivityTimeInput}
                                                    autoFocus
                                                    step={300}
                                                    onBlur={() => commitCustomTimeEdit(index, editingCustomTimeDraft)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter" || event.key === "Escape") {
                                                            event.preventDefault();
                                                            commitCustomTimeEdit(index, editingCustomTimeDraft);
                                                        }
                                                    }}
                                                    aria-label={t("Edit custom start time {time}", { time })}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.proactivityTimeListButton}
                                                    onClick={() => handleCustomTimeEdit(index)}
                                                >
                                                    <span className={styles.proactivityTimeLabel}>
                                                        {t(formatCustomTimeLabel(time))}
                                                    </span>
                                                </button>
                                            )}
                                            <div className={styles.proactivityTimeActions}>
                                                <button
                                                    type="button"
                                                    className={styles.listItemActionButton}
                                                    onClick={() => handleCustomTimeEdit(index)}
                                                    aria-label={t("Edit custom start time {time}", { time })}
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.listItemActionButton}
                                                    onClick={() => handleCustomTimeRemove(index)}
                                                    aria-label={t("Remove custom start time {time}", { time })}
                                                    disabled={customTimes.length <= 1}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className={styles.proactivityTimeAdd}
                                        onClick={handleCustomTimeAdd}
                                    >
                                        <Plus size={14} />
                                        <span>{t("Add time")}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}
                <footer className={styles.proactivityModalFooter}>
                    {showRemoveButton ? (
                        <button
                            type="button"
                            className={styles.proactivityModalSecondary}
                            onClick={() => {
                                if (onRemoveProactivity) onRemoveProactivity();
                                onClose();
                            }}
                        >
                            {modalRemoveLabel}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className={styles.proactivityModalDismiss}
                        onClick={onClose}
                    >
                        {t("Done")}
                    </button>
                </footer>
            </div>
        </div>
    );

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);

    if (!isMounted || !isOpen || typeof document === "undefined") return null;

    return createPortal(content, document.body);
}
