/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import styles from "./page.module.css";
import { PricingPlansSection } from "./PricingPlansSection";
import { useUser } from "@/contexts/UserContext";
import { DepthParticleBackground } from "@/components/backgrounds/DepthParticleBackground";

interface PricingClientProps {
  storeId?: string;
  voyagerVariantId?: string;
  pioneerVariantId?: string;
}

export default function PricingClient({ storeId, voyagerVariantId, pioneerVariantId }: PricingClientProps) {
  const router = useRouter();
  const { user } = useUser();

  const handleDismiss = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <div className={styles.page}>
      <DepthParticleBackground />
      <div className={styles.shell}>
        <div className={styles.inner}>
          <button
            type="button"
            className={styles.dismiss}
            onClick={handleDismiss}
            aria-label="Close pricing page"
          >
            <X size={20} />
          </button>
          <PricingPlansSection
            storeId={storeId}
            voyagerVariantId={voyagerVariantId}
            pioneerVariantId={pioneerVariantId}
            userId={user?.id}
          />
        </div>
      </div>
    </div>
  );
}
