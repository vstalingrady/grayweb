"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optional: Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100vh", 
          color: "white", 
          backgroundColor: "black", 
          gap: "1rem" 
        }}>
          <h2>Something went wrong!</h2>
          <button 
            onClick={() => reset()} 
            style={{ 
              padding: "0.5rem 1rem", 
              borderRadius: "0.5rem", 
              backgroundColor: "white", 
              color: "black", 
              border: "none", 
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}