import { Zap } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { ViewModeSelect } from "./ViewModeSelect";
import { useI18n } from "@/contexts/I18nContext";

export type DashboardHeaderProps = {
  activeTab: "pulse" | "calendar";
  onSelectTab: (tab: "pulse" | "calendar") => void;
  label?: string;
  title?: string;
  rangeLabel?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onPrevRange?: () => void;
  onNextRange?: () => void;
  onGoToday?: () => void;
  viewMode?: "week" | "day";
  onViewModeChange?: (mode: "week" | "day") => void;
  viewModeOptions?: Array<{ value: "week" | "day"; label: string }>;
  rangeNavigationLabel?: string;
  className?: string;
  todayButtonLabel?: string;
  streakCount?: number;
  hideCalendar?: boolean;
  onUpgradeClick?: () => void;
  showUpgradeButton?: boolean;
};

const DEFAULT_VIEW_OPTIONS: Array<{ value: "week" | "day"; label: string }> = [
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function DashboardHeader({
  activeTab,
  onSelectTab,
  label,
  title,
  rangeLabel,
  onPrevMonth,
  onNextMonth,
  onPrevRange,
  onNextRange,
  onGoToday,
  viewMode = "week",
  onViewModeChange,
  viewModeOptions = DEFAULT_VIEW_OPTIONS,
  rangeNavigationLabel = "range",
  className,
  todayButtonLabel = "Today",
  streakCount = 0,
  hideCalendar = false,
  onUpgradeClick,
  showUpgradeButton = false,
}: DashboardHeaderProps) {
  const { t } = useI18n();
  const headerClassName = [
    calendarStyles.calendarSurfaceHeader,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleViewModeChange = (nextMode: "week" | "day") => {
    if (!onViewModeChange) {
      return;
    }
    onViewModeChange(nextMode);
  };

  const isViewSelectDisabled = !onViewModeChange || viewModeOptions.length <= 1;
  const showMonthNavigation = Boolean(onPrevMonth || onNextMonth);
  const showRangeNavigation = Boolean(onPrevRange || onNextRange);
  const showTodayButton = Boolean(onGoToday);
  const showViewSelect = !isViewSelectDisabled;
  const shouldRenderControls =
    showMonthNavigation ||
    showRangeNavigation ||
    showTodayButton ||
    showViewSelect;

  const normalizedStreak = Number.isFinite(streakCount)
    ? Math.max(0, Math.trunc(streakCount))
    : 0;

  return (
    <header className={headerClassName}>
      <div className={calendarStyles.calendarSurfaceHeaderLeft}>
        <div className={calendarStyles.calendarSurfaceHeadingGroup}>
          {!hideCalendar && (
            <div className={calendarStyles.calendarSurfaceTabs}>
              <button
                type="button"
                className={calendarStyles.calendarSurfaceTab}
                data-active={activeTab === "pulse"}
                aria-pressed={activeTab === "pulse"}
                onClick={() => onSelectTab("pulse")}
              >
                {t("Pulse")}
              </button>
              <button
                type="button"
                className={calendarStyles.calendarSurfaceTab}
                data-active={activeTab === "calendar"}
                aria-pressed={activeTab === "calendar"}
                onClick={() => onSelectTab("calendar")}
              >
                {t("Calendar")}
              </button>
            </div>
          )}
        </div>
        {(label || title || rangeLabel) && (
          <div>
            {label && <span className={calendarStyles.calendarSurfaceLabel}>{label}</span>}
            {title && <h2 className={calendarStyles.calendarSurfaceTitle}>{title}</h2>}
            {rangeLabel && (
              <p className={calendarStyles.calendarSurfaceRange}>
                {rangeLabel}
              </p>
            )}
          </div>
        )}
      </div>
      <div className={calendarStyles.calendarSurfaceHeaderRight}>
	        {normalizedStreak > 0 ? (
	          <div
	            className={styles.streakBadge}
	            aria-label={t("{count} day streak", { count: normalizedStreak })}
	          >
	            <Zap size={12} />
	            <span>{normalizedStreak}</span>
	          </div>
	        ) : null}
        {shouldRenderControls && (
          <div className={calendarStyles.calendarSurfaceNav}>
            {showMonthNavigation && (
              <div className={calendarStyles.calendarSurfaceNavArrows}>
	                {onPrevMonth && (
	                  <button type="button" aria-label={t("Previous month")} onClick={onPrevMonth}>
	                    ‹
	                  </button>
	                )}
	                {onNextMonth && (
	                  <button type="button" aria-label={t("Next month")} onClick={onNextMonth}>
	                    ›
	                  </button>
	                )}
	              </div>
	            )}
            {showRangeNavigation && (
              <div className={calendarStyles.calendarSurfaceNavArrows}>
                {onPrevRange && (
	                  <button
	                    type="button"
	                    aria-label={t("Previous {range}", { range: rangeNavigationLabel })}
	                    onClick={onPrevRange}
	                  >
	                    ‹
	                  </button>
                )}
                {onNextRange && (
	                  <button
	                    type="button"
	                    aria-label={t("Next {range}", { range: rangeNavigationLabel })}
	                    onClick={onNextRange}
	                  >
	                    ›
	                  </button>
                )}
              </div>
            )}
            {showTodayButton && (
	              <button
	                type="button"
	                className={calendarStyles.calendarSurfaceButton}
	                onClick={onGoToday}
	              >
	                {t(todayButtonLabel)}
	              </button>
	            )}
	            {showViewSelect && (
	              <ViewModeSelect
	                value={viewMode}
	                options={viewModeOptions.map((option) => ({
	                  ...option,
	                  label: t(option.label),
	                }))}
	                onChange={handleViewModeChange}
	              />
	            )}
          </div>
        )}
      </div>
    </header>
  );
}
