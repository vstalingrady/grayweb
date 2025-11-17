const parseIsoDate = (iso?: string | null) => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const formatDatePart = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

const formatFullDate = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);

export const formatReminderDatePart = (iso?: string | null): string | null => {
  const date = parseIsoDate(iso);
  if (!date) {
    return null;
  }
  return formatDatePart(date);
};

export const formatReminderDateLabel = (iso?: string | null): string | null => {
  const date = parseIsoDate(iso);
  if (!date) {
    return null;
  }
  return formatFullDate(date);
};

export const formatReminderSlotLabel = (iso?: string | null, slot?: string | null): string | null => {
  if (!slot) {
    return null;
  }
  const trimmedSlot = slot.trim();
  if (!trimmedSlot) {
    return null;
  }
  const datePart = formatReminderDatePart(iso);
  if (datePart) {
    return `${datePart}, ${trimmedSlot}`;
  }
  return trimmedSlot;
};

const describeDayRelation = (date: Date, reference: Date) => {
  const startOf = (value: Date) => {
    const next = new Date(value);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const DAY_IN_MS = 86400000;
  const deltaDays = Math.round(
    (startOf(date).getTime() - startOf(reference).getTime()) / DAY_IN_MS
  );
  if (deltaDays === 0) return "Today";
  if (deltaDays === 1) return "Tomorrow";
  if (deltaDays === -1) return "Yesterday";
  if (deltaDays > 1 && deltaDays < 7) {
    return `This ${date.toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  if (deltaDays < -1 && deltaDays > -7) {
    return `Last ${date.toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  return null;
};

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export const formatReminderDisplayLabels = (
  iso?: string | null
): { primary: string | null; context: string | null } => {
  const date = parseIsoDate(iso);
  if (!date) {
    return { primary: null, context: null };
  }
  const weekday = WEEKDAY_FORMATTER.format(date);
  const monthDay = MONTH_DAY_FORMATTER.format(date);
  const time = TIME_FORMATTER.format(date);
  const primary = `${weekday} · ${monthDay} · ${time}`;
  const context = describeDayRelation(date, new Date());
  return { primary, context };
};
