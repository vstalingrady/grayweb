"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import styles from "./page.module.css";
import { PricingPlansSection } from "./PricingPlansSection";
import { useI18n } from "@/contexts/I18nContext";

const ParticleSphere = dynamic(
  () => import("@/components/backgrounds/ParticleSphere").then((mod) => mod.ParticleSphere),
  { ssr: false },
);

export default function PricingClient() {
  const router = useRouter();
  const { t } = useI18n();

  const handleDismiss = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className={styles.page}>
      <ParticleSphere />
      <div className={styles.shell}>
        <div className={styles.inner}>
          <button
            type="button"
            className={styles.dismiss}
            onClick={handleDismiss}
            aria-label={t("Close pricing page")}
          >
            <X size={20} />
          </button>
          <PricingPlansSection />
        </div>
      </div>
    </div>
  );
}
