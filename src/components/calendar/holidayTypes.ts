export type CalendarHolidayCountry = {
  code: string;
  name: string;
};

export type CalendarHoliday = {
  id: string;
  countryCode: string;
  date: Date;
  dateKey: string;
  name: string;
  localName?: string;
};

