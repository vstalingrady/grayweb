"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronDown, Calendar, CheckSquare, Bell, Clock } from "lucide-react";
import styles from "./styles.module.css";
import { apiService } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";

export type EventType = "Event" | "Task" | "Reminder";

interface CreateEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialDate?: Date;
    initialEndDate?: Date;
}

export function CreateEventModal({ isOpen, onClose, onSuccess, initialDate, initialEndDate }: CreateEventModalProps) {
    const { user } = useUser();
    const [type, setType] = useState<EventType>("Event");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Form states
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("");

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && initialDate) {
            // Format dates for inputs
            const start = initialDate;
            const end = initialEndDate || new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour duration

            setStartDate(start.toISOString().split('T')[0]);
            setStartTime(start.toTimeString().slice(0, 5));
            setEndDate(end.toISOString().split('T')[0]);
            setEndTime(end.toTimeString().slice(0, 5));

            // Reset fields
            setTitle("");
            setDescription("");
            setType("Event");
        }
    }, [isOpen, initialDate, initialEndDate]);

    // Close dropdown on click outside
    useEffect(() => {
        if (!isDropdownOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isDropdownOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !title) return;

        setIsSubmitting(true);

        try {
            const startDateTime = new Date(`${startDate}T${startTime}`);
            const endDateTime = new Date(`${endDate}T${endTime}`);

            if (type === "Event") {
                await apiService.createCalendarEvent(user.id, {
                    title,
                    description,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    calendar_id: 1 // Default to Personal for now
                });
            } else if (type === "Task") {
                await apiService.createPlan(user.id, {
                    label: title,
                    description,
                    deadline: endDateTime.toISOString(),
                    scheduleSlot: startDateTime.toISOString()
                });
            } else if (type === "Reminder") {
                await apiService.createReminder(user.id, {
                    label: title,
                    description,
                    remind_at: startDateTime.toISOString(),
                    status: "pending"
                });
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to create item:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <header className={styles.modalHeader}>
                    <div className={styles.typeSelector} ref={dropdownRef}>
                        <button
                            type="button"
                            className={styles.typeSelectorTrigger}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            {type === "Event" && <Calendar size={16} className={styles.typeIcon} />}
                            {type === "Task" && <CheckSquare size={16} className={styles.typeIcon} />}
                            {type === "Reminder" && <Bell size={16} className={styles.typeIcon} />}
                            <span className={styles.typeLabel}>{type}</span>
                            <ChevronDown size={14} className={`${styles.chevron} ${isDropdownOpen ? styles.chevronOpen : ''}`} />
                        </button>

                        {isDropdownOpen && (
                            <div className={styles.typeDropdown}>
                                <button type="button" className={styles.typeOption} onClick={() => { setType("Event"); setIsDropdownOpen(false); }}>
                                    <Calendar size={16} />
                                    <span>Event</span>
                                </button>
                                <button type="button" className={styles.typeOption} onClick={() => { setType("Task"); setIsDropdownOpen(false); }}>
                                    <CheckSquare size={16} />
                                    <span>Task</span>
                                </button>
                                <button type="button" className={styles.typeOption} onClick={() => { setType("Reminder"); setIsDropdownOpen(false); }}>
                                    <Bell size={16} />
                                    <span>Reminder</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <button type="button" onClick={onClose} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className={styles.modalForm}>
                    <div className={styles.formGroup}>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={type === "Event" ? "Add title" : type === "Task" ? "Task name" : "Remind me to..."}
                            className={styles.titleInput}
                            autoFocus
                            required
                        />
                    </div>

                    <div className={styles.dateTimeRow}>
                        <Clock size={16} className={styles.fieldIcon} />
                        <div className={styles.dateTimeInputs}>
                            <div className={styles.dateTimeGroup}>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={styles.dateInput}
                                />
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className={styles.timeInput}
                                />
                            </div>

                            {type === "Event" && (
                                <>
                                    <span className={styles.toSeparator}>to</span>
                                    <div className={styles.dateTimeGroup}>
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className={styles.timeInput}
                                        />
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className={styles.dateInput}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add description"
                            className={styles.descriptionInput}
                            rows={3}
                        />
                    </div>

                    <div className={styles.modalFooter}>
                        <button type="submit" className={styles.saveButton} disabled={isSubmitting || !title}>
                            {isSubmitting ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
