 "use client";

import HeroTesseract from "./HeroTesseract";
import { useI18n } from "@/contexts/I18nContext";

const HeroSection = () => {
  const { t } = useI18n();
  return (
    <section className="hero-section hero-section--split" aria-labelledby="hero-heading">
      <div className="hero-split">
        <div className="hero-split__text">
          <h1 id="hero-heading" className="hero-split__title">
            {t("Maximize human potential.")}
          </h1>
          <p className="hero-split__subtitle">{t("AI alignment research for all of humanity")}</p>
        </div>
        <div className="hero-split__visual hero-visual">
          <HeroTesseract />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
