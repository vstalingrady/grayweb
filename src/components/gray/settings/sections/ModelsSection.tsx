"use client";

import { Fragment } from "react";
import { Lock, Zap } from "lucide-react";
import styles from "../SettingsStyles.module.css";
import { ALL_PIONEER_MODEL_IDS, GRAY_BRAND, PIONEER_GROUPS } from "@/components/gray/modelCatalog";
import { SettingsLogo } from "@/components/gray/settings/components/SettingsLogo";
import { SettingsToggle } from "@/components/gray/settings/components/SettingsToggle";
import { PLAN_TIER_LEVELS } from "@/components/gray/utils/helperFunctions";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type ModelsSectionProps = {
  t: Translator;
  tierLevel: number;
  selectedModelId: string | null;
  modelTier: string | null;
  visibleModelIds: string[] | null;
  onVisibleModelIdsChange: (next: string[] | null) => void;
  modelSearchQuery: string;
  onModelSearchQueryChange: (next: string) => void;
  modelsStatus: string | null;
  onModelsStatusChange: (next: string | null) => void;
};

export function ModelsSection({
  t,
  tierLevel,
  selectedModelId,
  modelTier,
  visibleModelIds,
  onVisibleModelIdsChange,
  modelSearchQuery,
  onModelSearchQueryChange,
  modelsStatus,
  onModelsStatusChange,
}: ModelsSectionProps) {
  const visibleIds = visibleModelIds ?? ALL_PIONEER_MODEL_IDS;
  const renderModelLabel = (label: string, isFast?: boolean) => (
    <span className={styles.settingsFastLabel}>
      <span>{label}</span>
      {isFast ? <Zap size={13} className={styles.settingsFastIcon} aria-hidden="true" /> : null}
    </span>
  );

  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("Models")}</h2>
      </div>

      <div className={styles.settingsSection}>
        <p className={styles.settingsItemDescription} style={{ marginTop: 0, marginBottom: 16 }}>
          {t("Choose which models appear in your model selector. This won't affect existing conversations.")}
        </p>

        {modelsStatus ? (
          <p className={styles.settingsItemDescription} style={{ marginTop: 0, marginBottom: 16 }}>
            {modelsStatus}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            type="button"
            className={styles.settingsAction}
            onClick={() => {
              if (tierLevel < PLAN_TIER_LEVELS.voyager) {
                onModelsStatusChange(t("Upgrade to Voyager to customize models."));
                return;
              }
              onVisibleModelIdsChange(null);
              onModelsStatusChange(null);
            }}
          >
            {t("Show all")}
          </button>
          <button
            type="button"
            className={styles.settingsAction}
            onClick={() => {
              if (tierLevel < PLAN_TIER_LEVELS.voyager) {
                onModelsStatusChange(t("Upgrade to Voyager to customize models."));
                return;
              }
              if (selectedModelId && ALL_PIONEER_MODEL_IDS.includes(selectedModelId)) {
                onVisibleModelIdsChange([selectedModelId]);
              } else {
                onVisibleModelIdsChange([]);
              }
              onModelsStatusChange(null);
            }}
          >
            {t("Unselect all")}
          </button>
        </div>

        <input
          className={styles.settingsInput}
          value={modelSearchQuery}
          onChange={(event) => onModelSearchQueryChange(event.target.value)}
          placeholder={t("Search models...")}
          aria-label={t("Search models")}
        />
      </div>

      <div className={styles.settingsSection}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <SettingsLogo src={GRAY_BRAND.iconPath} alt={GRAY_BRAND.label} />
          <h3 className={styles.settingsSectionTitle} style={{ margin: 0 }}>
            {t("Gray")}
          </h3>
        </div>
        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Gray Lite")}</span>
            <span className={styles.settingsItemDescription}>{t("Always available.")}</span>
          </div>
        </div>
      </div>

      {(() => {
        const normalizedQuery = modelSearchQuery.trim().toLowerCase();

        const groupsToRender = PIONEER_GROUPS.flatMap((group) => {
          const matchesGroup = !normalizedQuery || group.label.toLowerCase().includes(normalizedQuery);
          const filteredModels = group.models.filter((model) => {
            if (!normalizedQuery) return true;
            const haystack = `${group.label} ${model.label} ${model.id}`.toLowerCase();
            return matchesGroup || haystack.includes(normalizedQuery);
          });

          return filteredModels.length ? [{ group, filteredModels }] : [];
        });

        const lockedRequiresPioneerOverall = groupsToRender.some(({ filteredModels }) =>
          filteredModels.some((model) => (model.tierRequired ?? "voyager") === "pioneer")
        );
        const premiumNote = lockedRequiresPioneerOverall
          ? t("Upgrade to Voyager or Pioneer to access.")
          : t("Upgrade to Voyager to access.");

        return (
          <>
            {tierLevel < PLAN_TIER_LEVELS.pathfinder && groupsToRender.length > 0 ? (
              <div className={styles.settingsTierSeparator} role="separator" aria-label={t("Premium models")}>
                <div className={styles.settingsTierSeparatorTitle}>{t("Premium models")}</div>
                <div className={styles.settingsTierSeparatorSubtitle}>{premiumNote}</div>
              </div>
            ) : null}

            {groupsToRender.map(({ group, filteredModels }) => (
              <div key={group.id} className={styles.settingsSection}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <SettingsLogo src={group.iconPath} alt={group.label} />
                  <h3 className={styles.settingsSectionTitle} style={{ margin: 0 }}>
                    {group.label}
                  </h3>
                </div>
                {(() => {
                  const modelRows = filteredModels.map((model) => {
                    const isSelected = modelTier === "pioneer" && selectedModelId === model.id;
                    const isEnabled = visibleModelIds === null || visibleIds.includes(model.id);
                    const requiredTier = model.tierRequired ?? "voyager";
                    const requiredLevel = PLAN_TIER_LEVELS[requiredTier] ?? PLAN_TIER_LEVELS.voyager;
                    const isTierLocked = tierLevel < requiredLevel;
                    const isScoutLocked = tierLevel < PLAN_TIER_LEVELS.pathfinder;
                    const isLocked = isScoutLocked || isTierLocked;

                    return { model, isSelected, isEnabled, requiredTier, isLocked };
                  });

                  const firstLockedIndex = modelRows.findIndex((row) => row.isLocked);
                  const lockedRequiresPioneer = modelRows.some(
                    (row) => row.isLocked && row.requiredTier === "pioneer"
                  );
                  const groupPremiumNote = lockedRequiresPioneer
                    ? t("Upgrade to Voyager or Pioneer to access.")
                    : t("Upgrade to Voyager to access.");

                  return modelRows.map((row, index) => (
                    <Fragment key={row.model.id}>
                      {tierLevel >= PLAN_TIER_LEVELS.pathfinder && index === firstLockedIndex ? (
                        <div
                          className={styles.settingsTierSeparator}
                          role="separator"
                          aria-label={t("Premium models")}
                        >
                          <div className={styles.settingsTierSeparatorTitle}>{t("Premium models")}</div>
                          <div className={styles.settingsTierSeparatorSubtitle}>{groupPremiumNote}</div>
                        </div>
                      ) : null}

                      <div
                        className={styles.settingsRow}
                        style={row.isLocked ? { opacity: 0.5, filter: "grayscale(1)" } : undefined}
                      >
                        <div className={styles.settingsLabelGroup}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <SettingsLogo src={group.iconPath} alt={group.label} />
                            <span className={styles.settingsLabel}>{renderModelLabel(row.model.label, row.model.isFast)}</span>
                          </div>
                          <span className={styles.settingsItemDescription}>
                            {row.model.cost ? (
                              <span className={styles.monoText}>{row.model.cost}</span>
                            ) : (
                              row.model.id
                            )}
                            {row.isSelected ? ` • ${t("Selected")}` : ""}
                          </span>
                        </div>
                        {row.isLocked ? (
                          <div style={{ padding: "0 10px", opacity: 0.5 }}>
                            <Lock size={16} />
                          </div>
                        ) : (
                          <SettingsToggle
                            checked={row.isEnabled}
                            onChange={() => {
                              if (row.isSelected) {
                                onModelsStatusChange(t("You can't hide the currently selected model."));
                                return;
                              }
                              if (visibleModelIds === null) {
                                const next = ALL_PIONEER_MODEL_IDS.filter((id) => id !== row.model.id);
                                onVisibleModelIdsChange(next);
                                onModelsStatusChange(null);
                                return;
                              }
                              if (row.isEnabled) {
                                onVisibleModelIdsChange(visibleModelIds.filter((id) => id !== row.model.id));
                                onModelsStatusChange(null);
                                return;
                              }
                              const next = Array.from(new Set([...visibleModelIds, row.model.id]));
                              onVisibleModelIdsChange(next.length === ALL_PIONEER_MODEL_IDS.length ? null : next);
                              onModelsStatusChange(null);
                            }}
                            label={t("Toggle {model}", { model: row.model.label })}
                          />
                        )}
                      </div>
                    </Fragment>
                  ));
                })()}
              </div>
            ))}
          </>
        );
      })()}
    </>
  );
}
