import type { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from "react";

import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import styles from "./GrayDashboardCalendar.module.css";
import { MiniMonth } from "./MiniMonth";
import { startOfDay, startOfMonth } from "./eventComposerUtils";
import { useI18n } from "@/contexts/I18nContext";

type EventComposerDatePickerProps = {
  selectedDate: Date;
  monthDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  setMonthDate: Dispatch<SetStateAction<Date>>;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: Dispatch<SetStateAction<boolean>>;
  datePickerTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  datePickerPopoverRef: MutableRefObject<HTMLDivElement | null>;
  datePopoverStyle: CSSProperties | undefined;
};

export function EventComposerDatePicker({
  selectedDate,
  monthDate,
  setSelectedDate,
  setMonthDate,
  isDatePickerOpen,
  setIsDatePickerOpen,
  datePickerTriggerRef,
  datePickerPopoverRef,
  datePopoverStyle,
}: EventComposerDatePickerProps) {
  const { t } = useI18n();

  return (
    <>
      <div className={styles.composerDateRow}>
        <button
          type="button"
          className={styles.composerDateTrigger}
          onClick={() => {
            setMonthDate(startOfMonth(selectedDate));
            setIsDatePickerOpen((previous) => !previous);
          }}
          aria-expanded={isDatePickerOpen ? "true" : "false"}
          aria-label={t("Choose date")}
          ref={datePickerTriggerRef}
        >
          <Calendar size={14} aria-hidden="true" className={styles.composerInlineControlIcon} />
          <span className={styles.composerInlineControlLabel}>
            {selectedDate.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={styles.composerInlineControlChevron}
          />
        </button>
      </div>

      {isDatePickerOpen ? (
        <div
          ref={datePickerPopoverRef}
          className={styles.composerDatePopover}
          style={datePopoverStyle}
          role="dialog"
          aria-label={t("Date picker")}
        >
          <div className={styles.composerDatePopoverHeader}>
            <span className={styles.composerDatePopoverMonthLabel}>
              {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <span className={styles.composerDatePopoverControls}>
              <button
                type="button"
                className={styles.composerDatePopoverNavButton}
                aria-label={t("Previous")}
                title={t("Go to previous month")}
                onClick={() =>
                  setMonthDate((previous) => {
                    const next = startOfMonth(previous);
                    next.setMonth(previous.getMonth() - 1);
                    return next;
                  })
                }
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className={styles.composerDatePopoverNavButton}
                aria-label={t("Next")}
                title={t("Go to next month")}
                onClick={() =>
                  setMonthDate((previous) => {
                    const next = startOfMonth(previous);
                    next.setMonth(previous.getMonth() + 1);
                    return next;
                  })
                }
              >
                <ChevronRight size={14} />
              </button>
            </span>
          </div>

          <div className={styles.composerMiniCalendarCompact}>
            <MiniMonth
              referenceDate={monthDate}
              selectedDate={selectedDate}
              onSelectDate={(nextDate) => {
                const normalized = startOfDay(nextDate);
                setSelectedDate(normalized);
                if (
                  normalized.getMonth() !== monthDate.getMonth() ||
                  normalized.getFullYear() !== monthDate.getFullYear()
                ) {
                  setMonthDate(startOfMonth(normalized));
                }
                setIsDatePickerOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

