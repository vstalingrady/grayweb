import React from 'react';
import styles from './DiagnosticModule.module.css';

export const DiagnosticModule = () => {
    return (
        <section className={styles.moduleWrapper}>
            <div className={styles.moduleContainer}>
                
                {/* LEFT PANEL: THE PROBLEM (CAGE) */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span className={styles.mono}>State: Trapped Potential</span>
                        <span className={styles.mono} style={{ color: 'var(--signal-red)' }}>LOCKED</span>
                    </div>
                    
                    <div className={styles.visBox}>
                        <div className={styles.cage}>
                            <div className={styles.cageBars}></div>
                            <div className={styles.trappedDot}></div>
                        </div>
                    </div>

                    <h3 className={styles.mono} style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>The "Gifted" Trap</h3>
                    <p className={styles.dim} style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                        You bounce around inside your own head. Intense energy, zero velocity. 
                        You procrastinate because the cage of "perfection" feels safer than the risk of failure.
                    </p>
                </div>

                {/* RIGHT PANEL: THE SOLUTION (BREAKOUT) */}
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <span className={styles.mono}>State: Gray Protocol</span>
                        <span className={styles.mono} style={{ color: 'var(--signal-green)' }}>UNBOUND</span>
                    </div>

                    <div className={styles.visBox}>
                        <div className={`${styles.cage} ${styles.broken}`}>
                            <div className={styles.cageBars}></div>
                            <div className={styles.escapeLine}>
                                <div className={styles.escapeHead}></div>
                            </div>
                        </div>
                    </div>

                    <h3 className={styles.mono} style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Breaking Out</h3>
                    <p className={styles.dim} style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                        Gray breaks the loop. It finds the single smallest opening—one actionable step—and 
                        launches you through it. Momentum replaces paralysis.
                    </p>
                </div>

            </div>
        </section>
    );
};

DiagnosticModule.displayName = "DiagnosticModule";
