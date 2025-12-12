import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from './IntroSequence.module.css';
import { useI18n } from "@/contexts/I18nContext";

interface IntroSequenceProps {
    onComplete: () => void;
}

export const INTRO_MESSAGES: string[] = [
    "Welcome to Gray.\n\nYour AI partner for personal growth.",
    "I'll help you set goals, build habits,\nand maximize your potential.",
    "Let's get started."
];

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
    const { t } = useI18n();
    const [step, setStep] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const exitScheduledRef = useRef(false);
    const localizedMessages = INTRO_MESSAGES.map((message) => t(message));
    const hasMessages = localizedMessages.length > 0;

    const handleNext = () => {
        if (exitScheduledRef.current) {
            return;
        }
        if (step < INTRO_MESSAGES.length - 1) {
            setIsTransitioning(true);
            setStep(prev => prev + 1);
            setIsTransitioning(false);
        } else {
            exitScheduledRef.current = true;
            setIsExiting(true);
            setTimeout(onComplete, 500); // Wait for exit animation
        }
    };

    // Allow keyboard navigation (Space/Enter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step]);

    return (
        <div
            className={`${styles.container} ${isExiting ? styles.exiting : ''}`}
            onClick={handleNext}
        >
            <div className={styles.content}>
                <div className={styles.logoWrapper}>
                    <span className={styles.logoAura} aria-hidden />
                    <div className={styles.logoRing}>
                        <div className={styles.logoCore}>
                            <Image
                                src="/grayaiwhitenotspinning.svg"
                                alt={t("Gray logo")}
                                fill
                                sizes="180px"
                                priority
                                className={styles.logo}
                            />
                        </div>
                    </div>
                </div>
                {hasMessages && !isTransitioning ? (
                    <div key={step} className={styles.messageFadeIn}>
                        {localizedMessages[step].split('\n').map((line, i) => (
                            <p key={i} className={styles.textLine}>
                                {line || <br />}
                            </p>
                        ))}
                    </div>
                ) : null}
                <div className={styles.hint}>
                    {t("Click or press Space to continue")}
                </div>
            </div>
        </div>
    );
};
