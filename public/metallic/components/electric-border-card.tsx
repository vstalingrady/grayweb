export default function ElectricBorderCard() {
  return (
    <>
      {/* SVG with turbulence lightning effect animation has been removed */}

      <div className="card-container">
        <div className="inner-container">
          <div className="main-card"></div>
          <div className="glow-layer-2"></div>
        </div>

        <div className="overlay-1"></div>
        <div className="overlay-2"></div>
        <div className="background-glow"></div>

        <div className="content-container">
          <div className="content-top">
            <div className="scrollbar-glass">Metallic</div>
            <p className="title">Silver Border</p>
          </div>

          <hr className="divider" />

          <div className="content-bottom">
            <p className="description">In case you&apos;d like to emphasize something with metallic elegance.</p>
          </div>
        </div>
      </div>
    </>
  )
}
