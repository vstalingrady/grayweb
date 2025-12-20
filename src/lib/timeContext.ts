const pad = (value: number) => String(Math.abs(value)).padStart(2, "0");

const formatUtcOffset = (offsetMinutes: number) => {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const totalMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${sign}${pad(hours)}:${pad(minutes)}`;
};

export const buildLocalTimeContext = (referenceDate?: Date) => {
  return buildLocalTimeContextWithOverrides(referenceDate);
};

type TimeContextOverrides = {
  timeZone?: string | null;
};

export const buildLocalTimeContextWithOverrides = (referenceDate?: Date, overrides?: TimeContextOverrides) => {
  const now = referenceDate ?? new Date();
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  const overrideTimeZone = overrides?.timeZone?.trim();
  const timeZone = overrideTimeZone || resolved.timeZone || "UTC";
  const offsetMinutes = -now.getTimezoneOffset();
  const utcOffset = formatUtcOffset(offsetMinutes);
  const tzLabel = `UTC${utcOffset}`;
  const isoTimestamp = now.toISOString();
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  const labeledTime = formatter.format(now);
  // Include explicit timezone offset and ISO timestamp for accurate reminder scheduling
  return `The user's local time is ${labeledTime}. Timezone metadata: ${tzLabel}, UTC${utcOffset}. ISO timestamp: ${isoTimestamp}. When creating reminders, output remind_at in ISO 8601 format with the user's timezone offset (e.g., 2024-12-11T21:00:00${utcOffset}). Do not mention the timezone or UTC offset unless the user asks. Avoid inferring or naming a specific city.`;
};

export default buildLocalTimeContext;
