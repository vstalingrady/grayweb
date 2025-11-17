const pad = (value: number) => String(Math.abs(value)).padStart(2, "0");

const formatUtcOffset = (offsetMinutes: number) => {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const totalMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${sign}${pad(hours)}:${pad(minutes)}`;
};

export const buildLocalTimeContext = (referenceDate?: Date) => {
  const now = referenceDate ?? new Date();
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  const timeZone = resolved.timeZone || "UTC";
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
  const labeledTime = formatter.format(now);
  const isoTimestamp = now.toISOString();
  const utcOffset = formatUtcOffset(-now.getTimezoneOffset());

  return `Current local time: ${labeledTime} (timezone: ${timeZone}, UTC${utcOffset}). ISO timestamp: ${isoTimestamp}`;
};

export default buildLocalTimeContext;
