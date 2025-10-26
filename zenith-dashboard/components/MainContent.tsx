import React, { useEffect, useMemo, useState } from 'react';
import { BellIcon } from './icons/BellIcon';
import { CheckIcon } from './icons/CheckIcon';
import type { UserProfile } from '../types';

type CalendarEvent = {
  title: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

const calendarStartHour = 8;
const calendarEndHour = 17;
const timelineHours = Array.from(
  { length: calendarEndHour - calendarStartHour + 1 },
  (_, index) => calendarStartHour + index
);

const calendarEvents: CalendarEvent[] = [];

const totalTimelineMinutes = (calendarEndHour - calendarStartHour) * 60;

const formatHourLabel = (hour: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${period}`;
};

const formatTimeLabel = (hour: number, minute: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
};

const PlanItem: React.FC<{ children: React.ReactNode; checked?: boolean }> = ({ children, checked }) => (
  <div
    className={`flex items-center gap-4 rounded-2xl border px-4 py-4 transition-colors ${
      checked
        ? 'border-white/10 bg-white/[0.02]'
        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
    }`}
  >
    <div
      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
        checked ? 'border-transparent bg-blue-600' : 'border-white/20'
      }`}
    >
      {checked && <CheckIcon className="h-3 w-3 text-white" />}
    </div>
    <span
      className={`text-sm font-medium ${
        checked ? 'text-white/50 line-through' : 'text-white'
      }`}
    >
      {children}
    </span>
  </div>
);

const deriveInitials = (name?: string | null) => {
  if (!name) return '??';
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const parts = trimmed
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

interface MainContentProps {
  user: UserProfile | null;
  userNameOverride: string;
  loadingUser: boolean;
}

const MainContent: React.FC<MainContentProps> = ({ user, userNameOverride, loadingUser }) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const displayName = user?.full_name ?? userNameOverride;
  const initials = user?.initials ?? deriveInitials(displayName);
  const hasProfileImage = Boolean(user?.profile_picture_url);

  const timeLabel = useMemo(
    () =>
      currentTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [currentTime]
  );

  const dateLabel = useMemo(
    () =>
      currentTime
        .toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })
        .toUpperCase(),
    [currentTime]
  );

  const greetingHeadline = useMemo(() => {
    const hour = currentTime.getHours();
    const windowLabel = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return `Good ${windowLabel}, ${displayName}`;
  }, [currentTime, displayName]);

  const cardDayLabel = useMemo(
    () =>
      currentTime.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [currentTime]
  );

  return (
    <main className="flex flex-1 flex-col px-12 py-10 pb-24">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-white/40">{timeLabel}</p>
          <h1 className="text-6xl font-semibold tracking-tight text-white">{greetingHeadline}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/40">
            {dateLabel.split(',')[0]}
          </p>
          <p className="text-xl font-semibold text-white/80">
            {dateLabel
              .split(',')
              .slice(1)
              .join(',')
              .trim()}
          </p>
        </div>
        <div className="flex items-center space-x-5">
          <div className="relative">
            <BellIcon className="h-6 w-6 text-white/60" />
            {/* Notification count will be populated from database */}
          </div>
          {hasProfileImage ? (
            <img
              src={user?.profile_picture_url ?? ''}
              alt={displayName}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white/80">
              {loadingUser ? '…' : initials}
            </div>
          )}
        </div>
      </header>

      {/* Widgets */}
      <div className="mt-14 grid flex-1 grid-cols-1 gap-10 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Calendar */}
        <div className="flex flex-col rounded-[34px] bg-black/60 p-6 shadow-[0_30px_60px_-35px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between rounded-[24px] bg-white/[0.02] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-white/40">Day</p>
              <p className="mt-1 text-lg font-semibold text-white">{cardDayLabel}</p>
            </div>
            <button className="rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/[0.12]">
              + New
            </button>
          </div>
          <div className="relative mt-6 flex flex-1 gap-6">
            <div className="flex flex-col justify-between text-right text-xs font-semibold uppercase tracking-[0.3em] text-white/30">
              {timelineHours.map((hour) => (
                <span key={hour} className="h-[52px]">
                  {formatHourLabel(hour)}
                </span>
              ))}
            </div>
            <div className="relative flex-1">
              <div className="absolute inset-0">
                {timelineHours.map((hour, index) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-white/10"
                    style={{ top: `${(index / (timelineHours.length - 1)) * 100}%` }}
                  />
                ))}
              </div>
              <div className="relative h-[520px]">
                {calendarEvents.map((event) => {
                  const startMinutes =
                    (event.startHour * 60 + event.startMinute) - calendarStartHour * 60;
                  const endMinutes =
                    (event.endHour * 60 + event.endMinute) - calendarStartHour * 60;
                  const top = (startMinutes / totalTimelineMinutes) * 100;
                  const height = ((endMinutes - startMinutes) / totalTimelineMinutes) * 100;
                  return (
                    <div
                      key={`${event.title}-${event.startHour}`}
                      className="absolute left-0 right-4"
                      style={{
                        top: `${top}%`,
                        height: `${Math.max(height, 6)}%`,
                      }}
                    >
                      <div className="flex h-full flex-col justify-center rounded-3xl bg-gradient-to-r from-[#4563FF] to-[#6F98FF] px-4 py-3 text-white shadow-[0_35px_60px_-35px_rgba(73,115,255,0.9)]">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">
                          {`${formatTimeLabel(event.startHour, event.startMinute)} - ${formatTimeLabel(event.endHour, event.endMinute)}`}
                        </span>
                        <span className="mt-1 text-sm font-semibold tracking-tight">
                          {event.title}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Plans */}
        <div className="flex h-full flex-col rounded-[34px] border border-white/10 bg-black/60 p-6 shadow-[0_30px_60px_-35px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              <button className="rounded-full bg-white text-xs font-semibold uppercase tracking-[0.25em] text-black px-4 py-2">
                Plans
              </button>
              <button className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
                Habits
              </button>
            </div>
            <span className="ml-auto text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Builder Pulse
            </span>
          </div>
          <div className="mt-6 flex-1 space-y-3">
            {/* Plans will be populated from database */}
          </div>
          <div className="mt-6">
            <button className="w-full rounded-full border border-white/15 bg-white/[0.06] py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/[0.12]">
              Add Plans
            </button>
          </div>
        </div>
      </div>
      
      {/* Ask Input */}
      <div className="mt-12 flex justify-center">
        <div className="sticky bottom-10 z-20 w-full max-w-2xl">
          <input
            type="text"
            placeholder="Ask anything"
            className="w-full rounded-full border border-white/10 bg-black/70 px-7 py-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/15"
          />
        </div>
      </div>
    </main>
  );
};

export default MainContent;
