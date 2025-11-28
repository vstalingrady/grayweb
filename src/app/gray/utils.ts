export const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  export const normalizeTimeValue = (value: string | null | undefined): string => {
    if (!value) {
      return "09:00";
    }
    const trimmed = value.trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!timeMatch) {
      return trimmed.slice(0, 5);
    }
    let hour = Number.parseInt(timeMatch[1], 10);
    const minute = Number.parseInt(timeMatch[2], 10);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return "09:00";
    }
    const period = timeMatch[3]?.toUpperCase();
    if (period === "AM") {
      if (hour === 12) {
        hour = 0;
      }
    } else if (period === "PM") {
      if (hour !== 12) {
        hour += 12;
      }
    }
    const normalizedHour = Math.max(0, Math.min(23, hour));
    const normalizedMinute = Math.max(0, Math.min(59, minute));
    return `${String(normalizedHour).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`;
  };
  
export const normalizeProactivityTimes = (
  times: string[] | null | undefined,
  fallback: string | null | undefined = null
): string[] => {
  const sourceTimes =
    Array.isArray(times) && times.length > 0
      ? times
      : fallback
        ? [fallback]
        : [];

  const normalized = sourceTimes
    .map((value) => normalizeTimeValue(value))
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();

  return normalized;
};

export const primaryProactivityTime = (times: string[] | null | undefined, fallback?: string | null) =>
  normalizeProactivityTimes(times ?? null, fallback)[0];
  
  export const normalizeProactivityChannels = (channels: string[] | null | undefined): string[] => {
    if (!Array.isArray(channels)) {
      return [];
    }
  
    const normalized = channels
      .map((channel) => (typeof channel === "string" ? channel.trim() : ""))
      .filter((channel) => channel.length > 0);
  
    return normalized.filter((channel, index, array) => array.indexOf(channel) === index);
  };
