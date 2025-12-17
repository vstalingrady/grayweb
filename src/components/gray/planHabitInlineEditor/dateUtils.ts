export { combineDateWithTime, startOfDay, startOfMonth } from "@/components/calendar/eventComposerUtils";

export const toDateTimeLocalString = (value: Date): string => {
  const offset = value.getTimezoneOffset();
  const normalized = new Date(value.getTime() - offset * 60000);
  return normalized.toISOString().slice(0, 16);
};

export const toDateTimeLocalValue = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const offset = parsed.getTimezoneOffset();
  const normalized = new Date(parsed.getTime() - offset * 60000);
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
