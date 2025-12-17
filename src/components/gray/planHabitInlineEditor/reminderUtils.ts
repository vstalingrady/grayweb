export type ReminderPreset =
  | "none"
  | "0"
  | "5"
  | "10"
  | "15"
  | "30"
  | "60"
  | "1440"
  | "custom";

const PRESET_MINUTES: ReadonlyArray<Exclude<ReminderPreset, "none" | "custom">> = [
  "0",
  "5",
  "10",
  "15",
  "30",
  "60",
  "1440",
];

export const deriveReminderPresetFromReminderAt = (options: {
  reminderAt: string | null | undefined;
  eventStart: Date;
}): { preset: ReminderPreset; customMinutes: string } => {
  const reminderAt = options.reminderAt;
  if (!reminderAt) {
    return { preset: "none", customMinutes: "" };
  }

  const remindAtMs = Date.parse(reminderAt);
  if (!Number.isFinite(remindAtMs)) {
    return { preset: "none", customMinutes: "" };
  }

  const deltaMinutes = Math.max(
    0,
    Math.round((options.eventStart.getTime() - remindAtMs) / 60000)
  );
  const matched = PRESET_MINUTES.find((value) => Number(value) === deltaMinutes);
  if (matched) {
    return { preset: matched, customMinutes: "" };
  }

  return { preset: "custom", customMinutes: String(deltaMinutes) };
};

export const parseReminderLeadMinutes = (
  preset: ReminderPreset,
  customReminderMinutes: string
): number | null => {
  if (preset === "none") {
    return null;
  }

  if (preset === "custom") {
    const parsed = Number.parseInt(customReminderMinutes.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }

  return Number.parseInt(preset, 10);
};

