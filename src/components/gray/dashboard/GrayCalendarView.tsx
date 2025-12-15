/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "@toast-ui/calendar/dist/toastui-calendar.min.css";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { apiService } from "@/lib/api";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { CreateEventModal } from "@/components/gray/dashboard/CreateEventModal";
import { ViewModeSelect } from "@/components/gray/ViewModeSelect";
import type { CalendarInfo } from "@/components/calendar/types";
import styles from "./styles.module.css";
import type { Options, EventObject } from "@toast-ui/calendar";

// Noir Theme Options for TUI Calendar
const NOIR_THEME: Options["theme"] = {
    common: {
        backgroundColor: "transparent",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        gridSelection: {
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
        },
        dayName: {
            color: "rgba(255, 255, 255, 0.6)",
        },
        holiday: {
            color: "rgba(255, 255, 255, 0.6)",
        },
        saturday: {
            color: "rgba(255, 255, 255, 0.6)",
        },
    },
    week: {
        dayName: {
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            backgroundColor: "transparent",
        },
        dayGrid: {
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            backgroundColor: "transparent",
        },
        dayGridLeft: {
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            backgroundColor: "transparent",
            width: "50px",
        },
        timeGridLeft: {
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            backgroundColor: "transparent",
            width: "50px",
        },
        timeGridLeftAdditionalTimezone: {
            backgroundColor: "transparent",
        },
        timeGridHalfHourLine: {
            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
        },
        timeGridHourLine: {
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        },
        nowIndicatorLabel: {
            color: "#ffc48c",
        },
        nowIndicatorPast: {
            border: "1px dashed #ffc48c",
        },
        nowIndicatorBullet: {
            backgroundColor: "#ffc48c",
        },
        nowIndicatorToday: {
            border: "1px solid #ffc48c",
        },
        nowIndicatorFuture: {
            border: "1px solid #ffc48c",
        },
        pastTime: {
            color: "rgba(255, 255, 255, 0.3)",
        },
        futureTime: {
            color: "rgba(255, 255, 255, 0.8)",
        },
    },
    month: {
        dayExceptThisMonth: {
            color: "rgba(255, 255, 255, 0.3)",
        },
        dayName: {
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            backgroundColor: "transparent",
        },
        holidayExceptThisMonth: {
            color: "rgba(255, 255, 255, 0.3)",
        },
        moreView: {
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            backgroundColor: "#1a1a1a",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            width: 320,
            height: 200,
        },
        moreViewTitle: {
            backgroundColor: "transparent",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "10px",
        },
        gridCell: {
            footerHeight: 31,
        },
    },
};

const TEMPLATE = {
    time(event: EventObject) {
        const { title } = event;
        return `<span style="color: white;">${title}</span>`;
    },
    allday(event: EventObject) {
        return `<span style="color: white;">${event.title}</span>`;
    },
};

export function GrayCalendarView() {
    const calendarContainerRef = useRef<HTMLDivElement | null>(null);
    const calendarInstanceRef = useRef<any>(null);
    const { user } = useUser();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<"week" | "day" | "month">("week");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [events, setEvents] = useState<Partial<EventObject>[]>([]);

    const [monthDate, setMonthDate] = useState(new Date());
    const [calendars, setCalendars] = useState<CalendarInfo[]>([
        { id: "1", label: "Personal", color: "#4e7cff", isVisible: true },
        { id: "2", label: "Work", color: "#ff6f61", isVisible: true },
    ]);

    // Custom Creation Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedStart, setSelectedStart] = useState<Date | undefined>(undefined);
    const [selectedEnd, setSelectedEnd] = useState<Date | undefined>(undefined);

    const syncCalendarEvents = useCallback(
        (nextEvents: Partial<EventObject>[]) => {
            const calendarInstance = calendarInstanceRef.current;
            if (!calendarInstance) return;

            try {
                calendarInstance.clear();
                calendarInstance.createEvents(nextEvents);
            } catch (err) {
                console.error("Failed to sync calendar events", err);
            }
        },
        []
    );

    useEffect(() => {
        let canceled = false;

        const initCalendar = async () => {
            if (!calendarContainerRef.current) return;
            if (calendarInstanceRef.current) return;

            try {
                const mod = await import("@toast-ui/calendar");
                if (canceled) return;
                const ToastUiCalendar = (mod as any).default ?? mod;

                const calendars: Options["calendars"] = [
                    {
                        id: "1",
                        name: "Personal",
                        backgroundColor: "#2f2f2f",
                        borderColor: "#2f2f2f",
                        color: "#ffffff",
                    },
                    {
                        id: "2",
                        name: "Work",
                        backgroundColor: "#3a3a3a",
                        borderColor: "#3a3a3a",
                        color: "#ffffff",
                    },
                ];

                const instance = new ToastUiCalendar(calendarContainerRef.current, {
                    defaultView: view,
                    theme: NOIR_THEME,
                    template: TEMPLATE,
                    calendars,
                    month: {
                        dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                        visibleWeeksCount: 6,
                    },
                    week: {
                        dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                        taskView: false,
                        eventView: ["allday", "time"],
                    },
                    useDetailPopup: true,
                    useCreationPopup: false,
                } satisfies Options);

                calendarInstanceRef.current = instance;

                instance.on("selectDateTime", (eventObj: any) => {
                    const { start, end } = eventObj;
                    setSelectedStart(start.toDate());
                    setSelectedEnd(end.toDate());
                    setIsCreateModalOpen(true);
                    instance.clearGridSelections();
                });

                syncCalendarEvents(events);
            } catch (err) {
                console.error("Failed to initialize calendar", err);
            }
        };

        void initCalendar();

        return () => {
            canceled = true;
            try {
                calendarInstanceRef.current?.destroy?.();
            } finally {
                calendarInstanceRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const visibleCalendarIds = new Set(calendars.filter(c => c.isVisible).map(c => c.id));
        const filteredEvents = events.filter(e => e.calendarId && visibleCalendarIds.has(String(e.calendarId)));
        syncCalendarEvents(filteredEvents);
    }, [events, calendars, syncCalendarEvents]);

    useEffect(() => {
        const calendarInstance = calendarInstanceRef.current;
        if (!calendarInstance) return;

        try {
            calendarInstance.changeView(view, true);
        } catch (err) {
            console.error("Failed to change calendar view", err);
        }
    }, [view]);

    // Fetch events when the user or date range changes
    const fetchEvents = useCallback(async () => {
        if (!user?.id) return;
        try {
            const fetched = await apiService.getCalendarEvents(user.id);
            // Transform backend events to TUI format
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tuiEvents = fetched.map((evt: any) => ({
                id: String(evt.id),
                calendarId: evt.calendar_id ? String(evt.calendar_id) : "1",
                title: evt.title,
                body: evt.description,
                start: evt.start_time,
                end: evt.end_time,
                category: "time",
                backgroundColor: evt.color || "#222",
                color: "#fff",
                borderColor: "transparent",
            }));
            setEvents(tuiEvents);
        } catch (err) {
            console.error("Failed to fetch events", err);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    useEffect(() => {
        // eslint-disable-next-line
        void fetchEvents();
    }, [fetchEvents]);

    // Handle navigation
    const handlePrev = () => {
        const calendarInstance = calendarInstanceRef.current;
        calendarInstance?.prev();
        setCurrentDate(new Date(calendarInstance?.getDate()));
    };

    const handleNext = () => {
        const calendarInstance = calendarInstanceRef.current;
        calendarInstance?.next();
        setCurrentDate(new Date(calendarInstance?.getDate()));
    };

    const handleToday = () => {
        const calendarInstance = calendarInstanceRef.current;
        calendarInstance?.today();
        setCurrentDate(new Date());
    };

    const handleViewChange = (newView: "week" | "day" | "month") => {
        setView(newView);
    };

    // MiniMonth selection handler
    const handleMiniMonthSelect = (date: Date) => {
        const calendarInstance = calendarInstanceRef.current;
        calendarInstance?.setDate(date);
        setCurrentDate(date);
        setMonthDate(date);
    };

    const handleMonthNavigate = (offset: number) => {
        setMonthDate(prev => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + offset);
            return next;
        });
    };

    const handleToggleCalendar = (calendarId: string) => {
        setCalendars(prev => prev.map(c =>
            c.id === calendarId ? { ...c, isVisible: !c.isVisible } : c
        ));
    };



    // Format month title
    const monthTitle = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

    return (
        <div className={styles.grayDashboard}>
            <div className={styles.dashboardCalendarLayout}>
                {/* Sidebar */}
                {/* Sidebar */}
                <CalendarSidebar
                    monthDate={monthDate}
                    selectedDate={currentDate}
                    onSelectDate={handleMiniMonthSelect}
                    onNavigateMonth={handleMonthNavigate}
                    calendars={calendars}
                    onToggleCalendar={handleToggleCalendar}
                    showCreateAction={true}
                    onIntegrationAction={() => { console.log("Integration clicked"); }}
                    className={styles.dashboardCalendarSidebar}
                />

                {/* Main Board */}
                <div className={styles.dashboardCalendarBoard}>
                    {/* Header */}
                    <header className={styles.calendarBoardHeader}>
                        <div className={styles.calendarBoardTitleArea}>
                            <h2 className={styles.calendarTitle}>{monthTitle}</h2>
                            <div className={styles.navControls}>
                                <button onClick={handlePrev} className={styles.navBtn} aria-label="Previous Month"><ChevronLeft size={16} /></button>
                                <button onClick={handleNext} className={styles.navBtn} aria-label="Next Month"><ChevronRight size={16} /></button>
                            </div>
                        </div>

                        <div className={styles.viewControls}>
                            <button onClick={handleToday} className={styles.todayBtn}>Today</button>
                            <ViewModeSelect
                                value={view}
                                options={[
                                    { value: "day", label: "Day" },
                                    { value: "week", label: "Week" },
                                    { value: "month", label: "Month" },
                                ]}
                                onChange={(nextView) => handleViewChange(nextView)}
                            />
                        </div>
                    </header>

                    {/* Wrapper for TUI Calendar */}
                    <div className={styles.calendarWrapper}>
                        <div ref={calendarContainerRef} style={{ width: "100%", height: "100%" }} />
                    </div>
                </div>
            </div>

            <CreateEventModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    void fetchEvents();
                }}
                initialDate={selectedStart}
                initialEndDate={selectedEnd}
            />
        </div>
    );
}
