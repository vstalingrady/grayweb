import React from 'react';
import styles from './PricingSection.module.css';

export const PricingSection = () => {
    return (
        <section className={styles.pricingSection}>
            <div className={styles.pricing}>
                {/* Free Tier */}
                <div className={styles.priceCard}>
                    <div className={styles.priceHeader}>STARTER</div>
                    <div className={styles.priceAmount}>$0 <span>/ mo</span></div>
                    <ul className={styles.featureList}>
                        <li className={styles.active}>10 Check-ins per day</li>
                        <li className={styles.active}>Gemini Flash Lite Model</li>
                        <li>Basic Memory</li>
                        <li>Standard Support</li>
                    </ul>
                    <a href="#" style={{ color: '#fff', textDecoration: 'underline', fontSize: '0.9rem' }}>Start Free</a>
                </div>

                {/* Pro Tier */}
                <div className={styles.priceCard}>
                    <div className={styles.priceHeader} style={{ color: 'var(--signal-green)' }}>ACCELERATOR</div>
                    <div className={styles.priceAmount}>$20 <span>/ mo</span></div>
                    <ul className={styles.featureList}>
                        <li className={styles.active}>Unlimited Proactive Check-ins</li>
                        <li className={styles.active}>Claude Sonnet 3.5 Intelligence</li>
                        <li className={styles.active}>Deep Context (Full History)</li>
                        <li className={styles.active}>Integrations (Calendar/Email)</li>
                    </ul>
                    <a href="#" className={styles.ctaBtn} style={{ width: '100%', textAlign: 'center', margin: '0' }}>JOIN ACCELERATOR</a>
                </div>
            </div>
        </section>
    );
};

PricingSection.displayName = "PricingSection";
