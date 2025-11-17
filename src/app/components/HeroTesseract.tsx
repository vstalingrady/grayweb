// Hero Tesseract component - temporarily simplified due to Three.js type issues
// This component is not critical to chat functionality
const HeroTesseract = () => {
  return (
    <div className="hero-tesseract">
      <div
        className="hero-tesseract__canvas"
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, rgba(0,0,0,0.1) 0%, rgba(255,255,255,0.05) 100%)",
          borderRadius: "8px"
        }}
        aria-hidden
      />
    </div>
  );
};

export default HeroTesseract;
