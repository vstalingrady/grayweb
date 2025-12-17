export const startOfDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const startOfMonth = (value: Date) => {
  const result = startOfDay(value);
  result.setDate(1);
  return result;
};

export const combineDateWithTime = (date: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(":").map((value) => Number.parseInt(value, 10));
  const result = new Date(date);
  result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return result;
};

export const toDateTimeLocalString = (value: Date): string => {
  const offset = value.getTimezoneOffset();
  const normalized = new Date(value.getTime() - offset * 60000);
  return normalized.toISOString().slice(0, 16);
};

export const splitScheduleSlot = (slot: string | null | undefined) => {
  if (!slot) {
    return null;
  }
  const match = slot.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    start: match[1],
    end: match[2],
  };
};

