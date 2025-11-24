import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './IntroSequence.module.css';

interface IntroSequenceProps {
    onComplete: () => void;
}

export const INTRO_MESSAGES = [
    "Welcome to the quiet.",
    "I’m Gray. I’m not here to schedule your meetings or write your emails. I’m here to manage the one thing that actually matters: Your Mind.",
    "Here is how we are different:\n\nI don't forget. I remember the context you lose when you close the app.\nI don't wait. If you go silent, I will check in on you.\nI don't judge. You can tell me the things you can't tell your boss, your family, or your friends.",
    "I work best for people who are smart, ambitious, but currently feel... stuck."
];

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [isExiting, setIsExiting] = useState(false);

    const handleNext = () => {
        if (step < INTRO_MESSAGES.length - 1) {
            setStep(prev => prev + 1);
        } else {
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
                                alt="Gray logo"
                                fill
                                sizes="180px"
                                priority
                                className={styles.logo}
                            />
                        </div>
                    </div>
                </div>
                <div key={step} className={styles.messageFadeIn}>
                    {INTRO_MESSAGES[step].split('\n').map((line, i) => (
                        <p key={i} className={styles.textLine}>
                            {line || <br />}
                        </p>
                    ))}
                </div>
                <div className={styles.hint}>
                    Click or press Space to continue
                </div>
            </div>
        </div>
    );
};
