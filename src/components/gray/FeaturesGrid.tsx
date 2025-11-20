import React from "react";
import styles from "./FeaturesGrid.module.css";

export const FeaturesGrid = () => {
    return (
        <section className={styles.featuresSection}>
            <div className="container mx-auto max-w-7xl">
                <div className={styles.mono}>THE EXPERIENCE</div>
                <div className={styles.featuresGrid}>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>●</span>
                        <div className={styles.featureTitle}>Proactive Intimacy</div>
                        <div className={styles.featureDesc}>
                            Gray doesn&apos;t wait for you to open the app. It checks in when you usually spiral. &quot;Hey, I know 2 PM is hard. How&apos;s the headspace?&quot;
                        </div>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>◆</span>
                        <div className={styles.featureTitle}>Deep Context</div>
                        <div className={styles.featureDesc}>
                            Gray remembers everything. &quot;Remember last week when you thought you couldn&apos;t do it, but finished in an hour? This is just like that.&quot;
                        </div>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>▲</span>
                        <div className={styles.featureTitle}>Pattern Interrupt</div>
                        <div className={styles.featureDesc}>
                            It notices when you&apos;re researching instead of building. It gently calls you out and pivots you back to the single smallest step.
                        </div>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>✶</span>
                        <div className={styles.featureTitle}>Pulse Planner</div>
                        <div className={styles.featureDesc}>
                            Plans, habits, and reminders live in a single daily pulse, pinned onto your calendar so you always know what matters this block of time.
                        </div>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>▢</span>
                        <div className={styles.featureTitle}>Reference Brain</div>
                        <div className={styles.featureDesc}>
                            Upload docs and research into Gray&apos;s reference library so every chat can pull from your own files, not just the public internet.
                        </div>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>☰</span>
                        <div className={styles.featureTitle}>Searchable History</div>
                        <div className={styles.featureDesc}>
                            A dedicated history view keeps every conversation organized with titles, timestamps, and quick reopen, so nothing useful gets lost.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

FeaturesGrid.displayName = "FeaturesGrid";
