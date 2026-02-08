"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import styles from "./SignUpPromptModal.module.css";
import { useI18n } from "@/contexts/I18nContext";

type SignUpPromptModalProps = {
    isOpen: boolean;
    onClose: () => void;
    messagesUsed?: number;
    messageLimit?: number;
};

export function SignUpPromptModal({
    isOpen,
    onClose,
    messagesUsed = 5,
    messageLimit = 5,
}: SignUpPromptModalProps) {
    const { t } = useI18n();
    const router = useRouter();
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const handleSignUp = useCallback(() => {
        router.push("/login?redirect=/g");
    }, [router]);

    const handleSignIn = useCallback(() => {
        router.push("/login?redirect=/g");
    }, [router]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        previousFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const rafId = window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus();
        });
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("keydown", handleKeyDown);
            previousFocusRef.current?.focus();
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className={styles.signUpPromptOverlay} role="dialog" aria-modal="true" aria-labelledby="sign-up-prompt-title">
            <div className={styles.signUpPromptContainer}>
                <button
                    ref={closeButtonRef}
                    type="button"
                    className={styles.signUpPromptClose}
                    onClick={onClose}
                    aria-label={t("Close")}
                >
                    <X size={20} />
                </button>

                <div className={styles.signUpPromptContent}>
                    <h2 id="sign-up-prompt-title" className={styles.signUpPromptTitle}>
                        {t("You've used all your free messages")}
                    </h2>
                    <p className={styles.signUpPromptDescription}>
                        {t("You've sent {count} of {limit} free messages. Sign up to continue chatting with Gray.", {
                            count: String(messagesUsed),
                            limit: String(messageLimit),
                        })}
                    </p>

                    <div className={styles.signUpPromptActions}>
                        <button
                            type="button"
                            className={styles.signUpPromptPrimaryButton}
                            onClick={handleSignUp}
                        >
                            {t("Sign up for free")}
                        </button>
                        <button
                            type="button"
                            className={styles.signUpPromptSecondaryButton}
                            onClick={handleSignIn}
                        >
                            {t("Already have an account? Sign in")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
