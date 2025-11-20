import HeroTesseract from "./HeroTesseract";

const HeroSection = () => (
  <section className="hero-section hero-section--split" aria-labelledby="hero-heading">
    <div className="hero-split">
      <div className="hero-split__text">
        <h1 id="hero-heading" className="hero-split__title">
          You know you're capable of more. Let's prove it.
        </h1>
        <p className="hero-split__subtitle">AI alignment research for all of humanity</p>
      </div>
      <div className="hero-split__visual hero-visual">
        <HeroTesseract />
      </div>
    </div>
  </section>
);

export default HeroSection;
