export const getWeekDays = (anchor: Date) => {
  const start = new Date(anchor);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
};

export const isSameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

export const isSameMonth = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();

export const formatMonthYear = (date: Date) =>
  date.toLocaleDateString([], { month: "long", year: "numeric" });

export const formatWeekRange = (week: Date[]) => {
  if (week.length !== 7) {
    return "";
  }
  const [start] = week;
  const end = week[6];
  const startMonth = start
    .toLocaleDateString([], { month: "long" })
    .toUpperCase();
  const endMonth = end
    .toLocaleDateString([], { month: "long" })
    .toUpperCase();
  const base = `${startMonth} ${start.getDate()} — ${endMonth} ${end.getDate()}`;
  return start.getFullYear() === end.getFullYear()
    ? `${base}, ${start.getFullYear()}`
    : `${base}, ${start.getFullYear()} — ${end.getFullYear()}`;
};

export const getCalendarMonth = (anchor: Date) => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const days: Date[] = [];

  for (let index = startOffset - 1; index >= 0; index -= 1) {
    days.push(new Date(year, month, -index));
  }

  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let date = 1; date <= lastDay; date += 1) {
    days.push(new Date(year, month, date));
  }

  while (days.length % 7 !== 0) {
    const nextDate = new Date(days[days.length - 1]);
    nextDate.setDate(nextDate.getDate() + 1);
    days.push(nextDate);
  }

  return days;
};
