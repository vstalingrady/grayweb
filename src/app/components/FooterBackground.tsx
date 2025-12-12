"use client";

import Image from "next/image";
import { useCallback } from "react";
import type { MouseEvent } from "react";
import { useI18n } from "@/contexts/I18nContext";

const FooterBackground = () => {
  const { t } = useI18n();
  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return (
    <div className="site-footer__media no-save" aria-hidden onContextMenu={handleContextMenu}>
      <picture className="site-footer__picture">
        <Image
          src="/astronaut.jpg"
          alt={t("Astronaut floating above Earth")}
          fill
          sizes="100vw"
          priority={false}
          className="site-footer__image"
          draggable={false}
        />
      </picture>
    </div>
  );
};

export default FooterBackground;
