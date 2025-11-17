"use client";

import Image from "next/image";
import { useCallback } from "react";
import type { MouseEvent } from "react";

const FooterBackground = () => {
  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return (
    <div className="site-footer__media no-save" aria-hidden onContextMenu={handleContextMenu}>
      <picture className="site-footer__picture">
        <Image
          src="/astronaut.jpg"
          alt="Astronaut floating above Earth"
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
