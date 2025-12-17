export const formatInlineDurationLabel = (startTime: string, endTime: string) => {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  let diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff)) {
    return "";
  }
  if (diff < 0) {
    diff += 24 * 60 * 60 * 1000;
  }

  const totalMinutes = Math.floor(diff / 60000);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${totalMinutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

