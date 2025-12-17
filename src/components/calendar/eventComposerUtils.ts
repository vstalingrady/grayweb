import { CalendarEntryType } from "./types";
export { startOfDay, startOfMonth } from "./dateUtils";

export const QUICK_COLOR_SWATCHES = [
  "#2F6B4F",
  "#3D6F73",
  "#B77A2B",
  "#C45A3C",
  "#7A5A3A",
  "#7A6A55",
  "#BEB5A7",
  "#8A7F73",
] as const;

export const DEFAULT_COLORS: Record<CalendarEntryType, string> = {
  event: "#3D6F73",
  task: "#B77A2B",
  plan: "#5E7E91",
  habit: "#5E9182",
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const rgbToHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

export const hexToRgb = (hex: string) => {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return { red, green, blue };
};

export const normalizeHex = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const expanded =
    withHash.length === 4
      ? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`
      : withHash;
  if (!/^#[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return expanded.toUpperCase();
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = clamp(saturation, 0, 100) / 100;
  const normalizedLightness = clamp(lightness, 0, 100) / 100;

  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const huePrime = normalizedHue / 60;
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = normalizedLightness - chroma / 2;

  const channelVariants: Array<[number, number, number]> = [
    [chroma, secondComponent, 0],
    [secondComponent, chroma, 0],
    [0, chroma, secondComponent],
    [0, secondComponent, chroma],
    [secondComponent, 0, chroma],
    [chroma, 0, secondComponent],
  ];

  const [redVariant, greenVariant, blueVariant] =
    channelVariants[Math.floor(clamp(huePrime, 0, 5.999))] ?? channelVariants[0];

  return rgbToHex(
    (redVariant + match) * 255,
    (greenVariant + match) * 255,
    (blueVariant + match) * 255
  );
};

const buildHslPalette = (options: {
  hues: number[];
  saturations: number[];
  lightnesses: number[];
}) => {
  const colors: string[] = [];
  for (const lightness of options.lightnesses) {
    for (const saturation of options.saturations) {
      for (const hue of options.hues) {
        colors.push(hslToHex(hue, saturation, lightness));
      }
    }
  }
  return Array.from(new Set(colors));
};

export const EARTHY_PALETTE = buildHslPalette({
  hues: [18, 28, 40, 52, 75, 98, 130, 160, 190, 210, 240, 285, 320],
  saturations: [28, 38],
  lightnesses: [34, 44],
});

export const PASTEL_PALETTE = buildHslPalette({
  hues: [16, 28, 40, 52, 75, 98, 130, 160, 190, 210, 240, 285, 320],
  saturations: [32, 44],
  lightnesses: [72, 80],
});

export const NEUTRAL_PALETTE = [
  "#F3F0EA",
  "#E6DED3",
  "#D5CCBF",
  "#C2B8AA",
  "#A79D8F",
  "#8C8275",
  "#6F665B",
  "#574F46",
] as const;

export const formatTimeInput = (date: Date) =>
  date
    .toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .padStart(5, "0");

export const combineDateWithTime = (date: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(":").map((value) => Number.parseInt(value, 10));
  const result = new Date(date);
  result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return result;
};

const parseTimeToMinutes = (timeValue: string) => {
  const [hoursRaw, minutesRaw] = timeValue.split(":");
  const hours = Number.parseInt(hoursRaw ?? "", 10);
  const minutes = Number.parseInt(minutesRaw ?? "", 10);

  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  return safeHours * 60 + safeMinutes;
};

export const formatDurationLabel = (startTime: string, endTime: string) => {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  let diffMinutes = endMinutes - startMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours <= 0) {
    return `${diffMinutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

export const isPointerEventInside = (event: globalThis.PointerEvent, element: HTMLElement | null) => {
  if (!element) return false;
  const target = event.target as Node | null;
  if (!target) return false;
  if (typeof event.composedPath === "function") {
    return event.composedPath().includes(element);
  }
  return element.contains(target);
};
