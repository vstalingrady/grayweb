export const formatEventTime = (date: Date) => {
  const hours24 = date.getHours();
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = date.getMinutes();
  const minuteSegment = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  const period = hours24 >= 12 ? "pm" : "am";
  return `${hour12}${minuteSegment}${period}`;
};

export const formatDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
