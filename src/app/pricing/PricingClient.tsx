/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import dynamic from "next/dynamic";
import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import styles from "./page.module.css";
import { PricingPlansSection } from "./PricingPlansSection";
import { useUser } from "@/contexts/UserContext";

const ParticleSphere = dynamic(
  () => import("@/components/backgrounds/ParticleSphere").then((mod) => mod.ParticleSphere),
  { ssr: false },
);

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
      <ParticleSphere />
      <div className={styles.shell}>
        <div className={styles.inner}>
          <button
            type="button"
            className={styles.dismiss}
            onClick={handleDismiss}
            aria-label="Tutup halaman harga"
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
