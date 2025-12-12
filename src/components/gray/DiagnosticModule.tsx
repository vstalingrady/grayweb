"use client";

/* eslint-disable react/no-unescaped-entities */
import { useState } from "react";
import styles from './DiagnosticModule.module.css';
import { X, Check } from 'lucide-react';
import { useI18n } from "@/contexts/I18nContext";

export const DiagnosticModule = () => {
    const { t } = useI18n();
    return (
        <section className={styles.moduleWrapper}>
            <div className={styles.introText}>
                <h2>{t("You're stuck between knowing and doing.")}</h2>
                <p>
                    {t(
                      "You know what you should do. You just can't seem to do it. Most people fail not because they're lazy, but because they lack the support system that makes success inevitable."
                    )}
                </p>
            </div>

            <div className={styles.moduleContainer}>

                {/* LEFT PANEL: THE PROBLEM */}
                <div className={`${styles.panel} ${styles.problemPanel}`}>
                    <div className={styles.visBox}>
                        <div className={styles.chaosContainer}>
                            <div className={styles.particle}></div>
                            <div className={styles.particle}></div>
                            <div className={styles.particle}></div>
                            <div className={styles.particle}></div>
                            <div className={styles.particle}></div>
                            <div className={styles.particle}></div>
                        </div>
                        <div className={styles.visLabel}>{t("ENTROPY")}</div>
                    </div>

                    <div className={styles.panelContent}>
                        <h3 className={styles.panelTitle}>
                            <X className={styles.iconRed} size={20} />
                            The Problem
                        </h3>
                        <ul className={styles.problemList}>
                            <li>
                                <span className={styles.bullet}></span>
                                {t("No external accountability")}
                            </li>
                            <li>
                                <span className={styles.bullet}></span>
                                {t("No one to call out your patterns")}
                            </li>
                            <li>
                                <span className={styles.bullet}></span>
                                {t("No structure to keep you on track")}
                            </li>
                            <li>
                                <span className={styles.bullet}></span>
                                {t("No accountability partner who deeply understands your context")}
                            </li>
                        </ul>
                    </div>
                </div>

                {/* RIGHT PANEL: THE SOLUTION */}
                <div className={`${styles.panel} ${styles.solutionPanel}`}>
                    <div className={styles.visBox}>
                        <div className={styles.flowContainer}>
                            <div className={styles.streamLine}></div>
                            <div className={styles.streamLine}></div>
                            <div className={styles.streamLine}></div>
                        </div>
                        <div className={styles.visLabel} style={{ color: '#00FF94' }}>{t("FLOW")}</div>
                    </div>

                    <div className={styles.panelContent}>
                        <h3 className={styles.panelTitle}>
                            <Check className={styles.iconGreen} size={20} />
                            The Solution
                        </h3>
                        <p className={styles.solutionText}>
                            {t(
                              "Gray gives you that system. An always-on accountability partner that notices when you slip,\n                            helps you get back on track, and pushes you to be your best self."
                            )}
                        </p>
                    </div>
                </div>

            </div>
        </section>
    );
};

DiagnosticModule.displayName = "DiagnosticModule";
