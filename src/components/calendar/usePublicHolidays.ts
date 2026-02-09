"use client";

import { useEffect, useMemo, useState } from "react";

import type { CalendarHoliday, CalendarHolidayCountry } from "./holidayTypes";
import { startOfMonth, toDateKey } from "./dateUtils";

const HOLIDAYS_ENABLED_STORAGE_KEY = "gray.calendar.holidays.enabled";
const HOLIDAY_COUNTRY_STORAGE_KEY = "gray.calendar.holidays.country";
const DEFAULT_COUNTRY_CODE = "US";
const HOLIDAY_RED = "#ff4c4c";
const HOLIDAY_API_BASE = "https://date.nager.at/api/v3";

type AvailableCountryResponse = {
  countryCode?: string;
  name?: string;
};

type HolidayResponse = {
  date?: string;
  localName?: string;
  name?: string;
  countryCode?: string;
};

type UsePublicHolidaysOptions = {
  monthDate: Date;
  selectedDate: Date;
  weekDays: Date[];
};

type UsePublicHolidaysResult = {
  holidayEnabled: boolean;
  holidayCountryCode: string;
  availableCountries: CalendarHolidayCountry[];
  holidayDateKeys: Set<string>;
  holidayNameByDateKey: Map<string, string>;
  weekHolidayEntries: CalendarHoliday[][];
  dayHolidayEntries: CalendarHoliday[];
  isHolidayCountryLoading: boolean;
  isHolidayDataLoading: boolean;
  setHolidayEnabled: (enabled: boolean) => void;
  setHolidayCountryCode: (countryCode: string) => void;
  holidayColor: string;
};

const isValidCountryCode = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^[A-Za-z]{2}$/.test(value);

const parseDateOnly = (value: string | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const resolveLocaleCountryCode = (): string => {
  if (typeof navigator === "undefined") {
    return DEFAULT_COUNTRY_CODE;
  }
  const language = navigator.language || "";
  const regionMatch = language.match(/-([A-Za-z]{2})$/);
  if (regionMatch) {
    return regionMatch[1].toUpperCase();
  }
  return DEFAULT_COUNTRY_CODE;
};

const getMiniMonthVisibleRangeYears = (monthDate: Date): Set<number> => {
  const years = new Set<number>();
  const firstDayOfMonth = startOfMonth(monthDate);
  const firstVisible = new Date(firstDayOfMonth);
  firstVisible.setDate(firstVisible.getDate() - firstVisible.getDay());

  for (let offset = 0; offset < 42; offset += 1) {
    const value = new Date(firstVisible);
    value.setDate(firstVisible.getDate() + offset);
    years.add(value.getFullYear());
  }
  return years;
};

const holidayCacheKey = (countryCode: string, year: number) =>
  `${countryCode.toUpperCase()}:${year}`;

export const usePublicHolidays = ({
  monthDate,
  selectedDate,
  weekDays,
}: UsePublicHolidaysOptions): UsePublicHolidaysResult => {
  const [holidayEnabled, setHolidayEnabled] = useState(false);
  const [holidayCountryCode, setHolidayCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [availableCountries, setAvailableCountries] = useState<CalendarHolidayCountry[]>([]);
  const [holidayCache, setHolidayCache] = useState<Record<string, CalendarHoliday[]>>({});
  const [isHolidayCountryLoading, setIsHolidayCountryLoading] = useState(false);
  const [isHolidayDataLoading, setIsHolidayDataLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedEnabled = window.localStorage.getItem(HOLIDAYS_ENABLED_STORAGE_KEY);
    const storedCountry = window.localStorage.getItem(HOLIDAY_COUNTRY_STORAGE_KEY);

    if (storedEnabled === "true" || storedEnabled === "false") {
      setHolidayEnabled(storedEnabled === "true");
    }

    if (isValidCountryCode(storedCountry)) {
      setHolidayCountryCode(storedCountry.toUpperCase());
    } else {
      setHolidayCountryCode(resolveLocaleCountryCode());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HOLIDAYS_ENABLED_STORAGE_KEY, holidayEnabled ? "true" : "false");
  }, [holidayEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HOLIDAY_COUNTRY_STORAGE_KEY, holidayCountryCode);
  }, [holidayCountryCode]);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadCountries = async () => {
      setIsHolidayCountryLoading(true);
      try {
        const response = await fetch(`${HOLIDAY_API_BASE}/AvailableCountries`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load countries: ${response.status}`);
        }

        const payload = (await response.json()) as AvailableCountryResponse[];
        if (!Array.isArray(payload)) {
          return;
        }

        const countries = payload
          .filter((item) => isValidCountryCode(item.countryCode) && typeof item.name === "string")
          .map((item) => ({
            code: item.countryCode!.toUpperCase(),
            name: item.name!.trim() || item.countryCode!.toUpperCase(),
          }))
          .sort((left, right) => left.name.localeCompare(right.name));

        if (!isActive) {
          return;
        }

        setAvailableCountries(countries);

        if (countries.length > 0) {
          const exists = countries.some((country) => country.code === holidayCountryCode);
          if (!exists) {
            const fallback =
              countries.find((country) => country.code === DEFAULT_COUNTRY_CODE) ?? countries[0];
            setHolidayCountryCode(fallback.code);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Unable to load available holiday countries:", error);
        }
      } finally {
        if (isActive) {
          setIsHolidayCountryLoading(false);
        }
      }
    };

    void loadCountries();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [holidayCountryCode]);

  const relevantYears = useMemo(() => {
    const years = new Set<number>();
    years.add(selectedDate.getFullYear());
    years.add(monthDate.getFullYear());
    weekDays.forEach((day) => years.add(day.getFullYear()));
    getMiniMonthVisibleRangeYears(monthDate).forEach((year) => years.add(year));
    return Array.from(years).sort((left, right) => left - right);
  }, [monthDate, selectedDate, weekDays]);

  useEffect(() => {
    if (!holidayEnabled || !holidayCountryCode || relevantYears.length === 0) {
      return;
    }

    const yearsToFetch = relevantYears.filter((year) => {
      const key = holidayCacheKey(holidayCountryCode, year);
      return !holidayCache[key];
    });

    if (yearsToFetch.length === 0) {
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    const loadHolidays = async () => {
      setIsHolidayDataLoading(true);

      try {
        const responses = await Promise.all(
          yearsToFetch.map(async (year) => {
            const response = await fetch(
              `${HOLIDAY_API_BASE}/PublicHolidays/${year}/${holidayCountryCode}`,
              { signal: controller.signal }
            );

            if (!response.ok) {
              throw new Error(
                `Failed to load holidays for ${holidayCountryCode} ${year}: ${response.status}`
              );
            }

            const payload = (await response.json()) as HolidayResponse[];
            const holidays = Array.isArray(payload)
              ? payload
                  .map((entry, index): CalendarHoliday | null => {
                    const parsedDate = parseDateOnly(entry.date);
                    if (!parsedDate) {
                      return null;
                    }
                    const dateKey = toDateKey(parsedDate);
                    const name = (entry.name || entry.localName || "Holiday").trim();
                    const localName = entry.localName?.trim() || undefined;
                    return {
                      id: `${holidayCountryCode}:${year}:${dateKey}:${index}`,
                      countryCode: (entry.countryCode || holidayCountryCode).toUpperCase(),
                      date: parsedDate,
                      dateKey,
                      name,
                      localName,
                    };
                  })
                  .filter((entry): entry is CalendarHoliday => Boolean(entry))
              : [];

            return { year, holidays };
          })
        );

        if (!isActive) {
          return;
        }

        setHolidayCache((previous) => {
          const next = { ...previous };
          responses.forEach(({ year, holidays }) => {
            next[holidayCacheKey(holidayCountryCode, year)] = holidays;
          });
          return next;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Unable to load public holidays:", error);
        }
      } finally {
        if (isActive) {
          setIsHolidayDataLoading(false);
        }
      }
    };

    void loadHolidays();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [holidayCache, holidayCountryCode, holidayEnabled, relevantYears]);

  const holidays = useMemo(() => {
    if (!holidayEnabled) {
      return [] as CalendarHoliday[];
    }
    const collected = relevantYears.flatMap((year) => {
      const key = holidayCacheKey(holidayCountryCode, year);
      return holidayCache[key] ?? [];
    });
    const deduped = new Map<string, CalendarHoliday>();
    collected.forEach((holiday) => {
      const key = `${holiday.countryCode}:${holiday.dateKey}:${holiday.name}`;
      if (!deduped.has(key)) {
        deduped.set(key, holiday);
      }
    });
    return Array.from(deduped.values()).sort(
      (left, right) => left.date.getTime() - right.date.getTime()
    );
  }, [holidayCache, holidayCountryCode, holidayEnabled, relevantYears]);

  const holidayDateKeys = useMemo(() => {
    const keys = new Set<string>();
    holidays.forEach((holiday) => keys.add(holiday.dateKey));
    return keys;
  }, [holidays]);

  const holidayNameByDateKey = useMemo(() => {
    const names = new Map<string, string>();
    holidays.forEach((holiday) => {
      const existing = names.get(holiday.dateKey);
      if (!existing) {
        names.set(holiday.dateKey, holiday.localName || holiday.name);
        return;
      }
      names.set(holiday.dateKey, `${existing}; ${holiday.localName || holiday.name}`);
    });
    return names;
  }, [holidays]);

  const holidaysByDateKey = useMemo(() => {
    const grouped = new Map<string, CalendarHoliday[]>();
    holidays.forEach((holiday) => {
      const next = grouped.get(holiday.dateKey) ?? [];
      next.push(holiday);
      grouped.set(holiday.dateKey, next);
    });
    return grouped;
  }, [holidays]);

  const weekHolidayEntries = useMemo(
    () =>
      weekDays.map((day) => {
        const key = toDateKey(day);
        return holidaysByDateKey.get(key) ?? [];
      }),
    [holidaysByDateKey, weekDays]
  );

  const dayHolidayEntries = useMemo(() => {
    const key = toDateKey(selectedDate);
    return holidaysByDateKey.get(key) ?? [];
  }, [holidaysByDateKey, selectedDate]);

  return {
    holidayEnabled,
    holidayCountryCode,
    availableCountries,
    holidayDateKeys,
    holidayNameByDateKey,
    weekHolidayEntries,
    dayHolidayEntries,
    isHolidayCountryLoading,
    isHolidayDataLoading,
    setHolidayEnabled,
    setHolidayCountryCode,
    holidayColor: HOLIDAY_RED,
  };
};
