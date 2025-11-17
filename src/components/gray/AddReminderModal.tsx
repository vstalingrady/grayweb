"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { apiService, type Reminder } from "@/lib/api";
import { requestNotificationPermission } from "@/lib/notificationUtils";

type DeliveryMode = "plan" | "reminder";

type AddReminderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userId?: number | null;
  onSuccess?: () => Promise<void> | void;
  defaultMode?: DeliveryMode;
  reminderToEdit?: Reminder | null;
};

const DELIVERY_OPTIONS: { id: DeliveryMode; label: string; hint: string }[] = [
  { id: "plan", label: "Plan reminder", hint: "Pin this to your plan list and keep it visible." },
  { id: "reminder", label: "One-time reminder", hint: "Treat this like a lightweight nudge." },
];

export function AddReminderModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  defaultMode = "plan",
  reminderToEdit,
}: AddReminderModalProps) {
  const [label, setLabel] = useState("");
  const [when, setWhen] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(defaultMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(reminderToEdit);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (reminderToEdit) {
      setLabel(reminderToEdit.label ?? "");
      const remindAtValue = reminderToEdit.remind_at ? new Date(reminderToEdit.remind_at) : null;
      if (remindAtValue && !Number.isNaN(remindAtValue.getTime())) {
        const normalized = new Date(
          remindAtValue.getTime() - remindAtValue.getTimezoneOffset() * 60000
        );
        setWhen(normalized.toISOString().slice(0, 16));
      } else {
        setWhen("");
      }
      setDescription(reminderToEdit.description ?? reminderToEdit.summary ?? "");
      setDeliveryMode(reminderToEdit.delivery_mode === "reminder" ? "reminder" : "plan");
    } else {
      setLabel("");
      setWhen("");
      setDescription("");
      setDeliveryMode(defaultMode);
    }
    setIsSubmitting(false);
    setError(null);
  }, [defaultMode, isOpen, reminderToEdit]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) {
      setError("You need to be signed in to save reminders.");
      return;
    }
    if (!label.trim() || !when.trim()) {
      setError("Please provide a reminder and a time.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const remindAt = new Date(when);
      if (Number.isNaN(remindAt.getTime())) {
        throw new Error("Please choose a valid time.");
      }
      if (reminderToEdit) {
        await apiService.updateReminder(userId, reminderToEdit.id, {
          label: label.trim(),
          remind_at: remindAt.toISOString(),
          description: description.trim() || null,
          summary: description.trim() || null,
          delivery_mode: deliveryMode,
        });
      } else {
        await apiService.createReminder(userId, {
          label: label.trim(),
          remind_at: remindAt.toISOString(),
          description: description.trim() || null,
          delivery_mode: deliveryMode,
          summary: description.trim() || null,
        });
      }
      void requestNotificationPermission();
      if (onSuccess) {
        await onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("[AddReminderModal] Failed to save reminder", err);
      setError(err instanceof Error ? err.message : "Failed to save reminder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.personalizationOverlay}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={styles.personalizationPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-reminder-title"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "720px", width: "90%" }}
      >
        <header className={styles.personalizationPanelHeader}>
          <div>
            <h2 id="add-reminder-title">{isEditing ? "Edit Reminder" : "Add Reminder"}</h2>
            <p className={styles.personalizationHint}>
              {isEditing
                ? "Refresh the timing or details and I'll keep things aligned."
                : "Give it a name, then choose when we should nudge you."}
            </p>
          </div>
          <button
            type="button"
            className={styles.personalizationClose}
            onClick={onClose}
            aria-label="Close add reminder"
            disabled={isSubmitting}
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className={styles.personalizationGrid}
          style={{
            marginTop: "12px",
            gridTemplateColumns: "minmax(0, 1fr)",
            alignItems: "stretch",
          }}
        >
          <div className={styles.personalizationColumn}>
            <section className={styles.personalizationCard}>
              <div className={styles.personalizationFieldGroup}>
                <label htmlFor="reminder-label-field">Reminder *</label>
                <textarea
                  id="reminder-label-field"
                  className={styles.personalizationField}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="E.g. Send weekly check-in, call doctor, etc."
                  disabled={isSubmitting}
                  rows={3}
                  autoFocus
                  required
                />
              </div>

              <div className={styles.personalizationFieldGroup} style={{ marginTop: "16px" }}>
                <label htmlFor="reminder-when-field">When *</label>
                <input
                  id="reminder-when-field"
                  type="datetime-local"
                  className={styles.personalizationField}
                  value={when}
                  onChange={(event) => setWhen(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className={styles.personalizationFieldGroup} style={{ marginTop: "16px" }}>
                <label htmlFor="reminder-details-field">Details</label>
                <textarea
                  id="reminder-details-field"
                  className={styles.personalizationField}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add notes, links, or context (optional)"
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>

              <div className={styles.personalizationFieldGroup} style={{ marginTop: "20px" }}>
                <span style={{ display: "block", fontSize: "0.85rem", color: "rgba(255,255,255,0.65)" }}>
                  Delivery mode
                </span>
                <div className={styles.reminderModeToggle}>
                  {DELIVERY_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDeliveryMode(option.id)}
                      data-active={deliveryMode === option.id}
                    >
                      <span>{option.label}</span>
                      <small>{option.hint}</small>
                    </button>
                  ))}
                </div>
              </div>

              {error ? (
                <p className={styles.personalizationHint} style={{ color: "#ff6b6b", marginTop: "12px" }}>
                  {error}
                </p>
              ) : null}

              <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
                <button
                  type="button"
                  className={styles.personalizationLink}
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.secondaryAction}
                  disabled={isSubmitting || !label.trim() || !when.trim()}
                  style={{ flex: 1 }}
                >
                  {isSubmitting ? "Saving..." : "Save Reminder"}
                </button>
              </div>
            </section>
          </div>
        </form>
      </div>
    </div>
  );
}
