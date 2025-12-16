"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";

// Greeting messages for mobile welcome screen - time-based and fun options
const MORNING_GREETINGS = [
  "Good morning! Ready to conquer the day?",
  "Rise and shine! What's the plan?",
  "Morning! Coffee kicked in yet?",
  "Good morning! Let's make today count.",
  "Up early? I respect that. How can I help?",
  "Morning! The early bird gets the worm. What's yours?",
];

const AFTERNOON_GREETINGS = [
  "Good afternoon! How's the day going?",
  "Afternoon check-in. What do you need?",
  "Hey there! Surviving the afternoon slump?",
  "Good afternoon! Halfway through - what's next?",
  "Still going strong? What can I do?",
  "Afternoon! Need a productivity boost?",
];

const EVENING_GREETINGS = [
  "Good evening! Winding down or ramping up?",
  "Evening! Still hustling, I see.",
  "Good evening! What brings you here?",
  "Hey! Burning the midnight oil?",
  "Evening vibes. How can I help?",
  "Good evening! Let's finish strong.",
];

const NIGHT_GREETINGS = [
  "Still awake? Me too. What's up?",
  "Night owl mode activated. What do you need?",
  "Can't sleep? Let's be productive then.",
  "Late night thoughts? I'm here.",
  "Hello, fellow insomniac. How can I help?",
  "The quiet hours. What's on your mind?",
];

const GENERAL_GREETINGS = [
  "Hey! What's on your mind?",
  "Ready when you are.",
  "What would you like to explore?",
  "Let's get things done.",
  "Ask me anything.",
  "How can I help you today?",
  "What are we working on?",
  "I'm all ears. Well, algorithms.",
  "Your wish is my command. Almost.",
  "Let's make something happen.",
];

const getRandomGreeting = (): string => {
  const hour = new Date().getHours();
  let pool: string[];

  if (hour >= 5 && hour < 12) {
    pool = [...MORNING_GREETINGS, ...GENERAL_GREETINGS];
  } else if (hour >= 12 && hour < 17) {
    pool = [...AFTERNOON_GREETINGS, ...GENERAL_GREETINGS];
  } else if (hour >= 17 && hour < 22) {
    pool = [...EVENING_GREETINGS, ...GENERAL_GREETINGS];
  } else {
    pool = [...NIGHT_GREETINGS, ...GENERAL_GREETINGS];
  }

  return pool[Math.floor(Math.random() * pool.length)];
};

export const MobileWelcomeScreen = memo(() => {
  const { t } = useI18n();
  const greetingKey = useMemo(() => getRandomGreeting(), []);
  const greeting = t(greetingKey);

  return (
    <div className={styles.mobileWelcomeScreen}>
      <div className={styles.mobileWelcomeContent}>
        <div className={styles.mobileWelcomeLogo}>
          <Image
            src="/grayaiwhitenotspinning.svg"
            alt=""
            width={40}
            height={40}
            className={styles.uiIconImage}
          />
        </div>
        <p className={styles.mobileWelcomeGreeting}>{greeting}</p>
      </div>
    </div>
  );
});
MobileWelcomeScreen.displayName = "MobileWelcomeScreen";
