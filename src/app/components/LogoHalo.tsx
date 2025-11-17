import Image from "next/image";

type LogoHaloProps = {
  className?: string;
  priority?: boolean;
  sizes?: string;
  offset?: {
    x: number;
    y: number;
  };
};

const LogoHalo = ({
  className = "",
  priority = false,
  sizes = "(min-width: 1280px) 700px, (min-width: 1024px) 560px, (min-width: 768px) 420px, 320px",
  // offset = { x: 0, y: 0 },
}: LogoHaloProps) => {
  const classes = ["hero-logo-field", className].filter(Boolean).join(" ");

  return (
    <div className={classes} aria-hidden>
      <div className="hero-logo-field__rays" />
      <div className="logo-main">
        <Image
          className="logo-hexagon"
          src="/grayaiwhite.svg"
          alt="Gray Vision mark"
          fill
          priority={priority}
          sizes={sizes}
        />
      </div>
    </div>
  );
};

export default LogoHalo;
