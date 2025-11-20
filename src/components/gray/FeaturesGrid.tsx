import React from 'react';
import styles from './FeaturesGrid.module.css';

export const FeaturesGrid = () => {
    return (
        <section className={styles.featuresSection}>
            <div className={styles.mono} style={{ textAlign: 'center', marginBottom: '2rem' }}>THE EXPERIENCE</div>
            <div className="container">
                <div className={styles.featuresGrid}>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>●</span>
                        <div className={styles.featureTitle}>Proactive Intimacy</div>
                        <div className={styles.featureDesc}>
                            Gray doesn't wait for you to open the app. It checks in when you usually spiral. "Hey, I know 2 PM is hard. How's the headspace?"
                        </div>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>◆</span>
                        <div className={styles.featureTitle}>Deep Context</div>
                        <div className={styles.featureDesc}>
                            Gray remembers everything. "Remember last week when you thought you couldn't do it, but finished in an hour? This is just like that."
                        </div>
                    </div>
                    <div className={styles.featureCard}>
                        <span className={styles.featureIcon}>▲</span>
                        <div className={styles.featureTitle}>Pattern Interrupt</div>
                        <div className={styles.featureDesc}>
                            It notices when you're researching instead of building. It gently calls you out and pivots you back to the single smallest step.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

FeaturesGrid.displayName = "FeaturesGrid";
