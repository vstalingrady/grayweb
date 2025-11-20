import React from 'react';
import styles from './HeroLanding.module.css';

export const HeroLanding = () => {
    return (
        <section className={styles.hero}>
            <div className={styles.mono} style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>PROACTIVE LIFE OS // v1.0</div>
            <h1>FOR THE SMART KID<br/>WHO STOPPED TRYING.</h1>
            <p className={styles.subtitle}>
                You don't need a list. You need a structure that understands your burnout.
                Gray is the compassionate architect that helps you break paralysis and start building again.
            </p>
        </section>
    );
};

HeroLanding.displayName = "HeroLanding";
