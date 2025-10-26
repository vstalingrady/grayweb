"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Mic, Sparkles } from "lucide-react";
import styles from "./GeminiPageClient.module.css";
import { GeminiSidebar } from "@/components/gemini/GeminiSidebar";
import { GeminiDashboardView } from "@/components/gemini/GeminiDashboardView";
import { GeminiCalendarView } from "@/components/gemini/GeminiCalendarView";
import { formatDisplayName } from "@/lib/names";

type GeminiPageClientProps = {
  viewerEmail: string | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
};

const EVENT_BLUEPRINT: CalendarEvent[] = [
  {
    id: "event-1",
    title: "Builder cohort sync",
    start: "2025-10-22T08:30:00",
    end: "2025-10-22T09:15:00",
    location: "Arcadia South",
  },
  {
    id: "event-2",
    title: "Proactivity instrumentation review",
    start: "2025-10-23T11:00:00",
    end: "2025-10-23T12:00:00",
  },
  {
    id: "event-3",
    title: "Pulse QA slot",
    start: "2025-10-24T15:30:00",
    end: "2025-10-24T16:00:00",
  },
  {
    id: "event-4",
    title: "Alignment recap + journaling",
    start: "2025-10-25T19:00:00",
    end: "2025-10-25T19:45:00",
  },
];

export default function GeminiPageClient({ viewerEmail }: GeminiPageClientProps) {
  const [activeDate, setActiveDate] = useState(() => new Date("2025-10-25T12:00:00"));
  const [view, setView] = useState<"dashboard" | "calendar">("dashboard");

  const viewerName = useMemo(() => formatDisplayName(null, viewerEmail), [viewerEmail]);
  const viewerRole = "Operator";
  const greeting = useMemo(() => {
    const hour = activeDate.getHours();
    if (hour < 12) {
      return "Good morning";
    }
    if (hour < 18) {
      return "Good afternoon";
    }
    return "Good evening";
  }, [activeDate]);

  const events = useMemo(() => EVENT_BLUEPRINT, []);

  const handleNavigate = (action: "today" | "prev" | "next") => {
    if (action === "today") {
      setActiveDate(new Date());
      return;
    }
    setActiveDate((previous) => {
      const updated = new Date(previous);
      updated.setDate(updated.getDate() + (action === "next" ? 7 : -7));
      return updated;
    });
  };

  const handlePlanToCalendar = () => {
    setView("calendar");
  };

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.layout}>
          <GeminiSidebar
            currentDate={activeDate}
            onChangeDate={setActiveDate}
            isCalendarView={view === "calendar"}
            viewerName={viewerName}
            viewerRole={viewerRole}
          />

          <div className={styles.main}>
            <section className={styles.contentShell}>
              <header className={styles.header}>
                <div className={styles.headerTitle}>
                  <span>Alignment workspace</span>
                  <h1>{greeting}, {viewerName}</h1>
                </div>
                <div className={styles.headerActions}>
                  <span className={`${styles.chip} ${styles.chipPrimary}`}>
                    <Sparkles size={16} />
                    Synced moments ago
                  </span>
                  <div className={styles.toggleGroup}>
                    <button
                      type="button"
                      className={styles.toggleButton}
                      data-active={view === "dashboard" ? "true" : "false"}
                      onClick={() => setView("dashboard")}
                    >
                      Pulse
                    </button>
                    <button
                      type="button"
                      className={styles.toggleButton}
                      data-active={view === "calendar" ? "true" : "false"}
                      onClick={() => setView("calendar")}
                    >
                      Week plan
                    </button>
                  </div>
                </div>
              </header>

              <div className={styles.mainContent}>
                {view === "dashboard" ? (
                  <GeminiDashboardView
                    activeDate={activeDate}
                    onCreateMeeting={handlePlanToCalendar}
                  />
                ) : (
                  <GeminiCalendarView
                    activeDate={activeDate}
                    onNavigate={handleNavigate}
                    events={events}
                  />
                )}
              </div>
            </section>

            <div className={styles.commandBar}>
              <div className={styles.commandInput}>
                <Sparkles size={16} />
                <span>Ask Gray to arrange focus blocks or send a recap…</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span className={styles.commandShortcut}>CTRL + K</span>
                <button
                  type="button"
                  className={styles.toggleButton}
                  style={{ padding: "10px 14px" }}
                >
                  <Mic size={16} />
                  Capture note
                </button>
                <button
                  type="button"
                  className={styles.toggleButton}
                  style={{ padding: "10px 14px" }}
                  onClick={handlePlanToCalendar}
                >
                  <ArrowUpRight size={16} />
                  Open calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
