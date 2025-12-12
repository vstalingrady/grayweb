import "server-only";

import fs from "node:fs";
import path from "node:path";

const marketingCssPath = path.join(process.cwd(), "src", "app", "components", "marketing-globals.css");

function loadMarketingCss() {
  try {
    return fs
      .readFileSync(marketingCssPath, "utf8")
      .replace('@import "tailwindcss";', "")
      .replace(/@theme inline\s*\{[\s\S]*?\}/, "")
      .trim();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("MarketingStyles: unable to load legacy CSS", error);
    }
    return "";
  }
}

const coexistenceOverrides = `
:root {
  color-scheme: dark;
  --font-sans: "Plus Jakarta Sans";
}

/* Ensure marketing layout isn't affected by Gray dashboard globals */
html {
  height: auto;
}

body {
  display: block !important;
  min-height: 100vh;
  height: auto;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 !important;
  margin: 0;
  background-color: #000000;
  color: #fffefa;
  font-family: var(--font-sans), "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif;
  letter-spacing: 0.01em;
}

#__next,
#root {
  height: auto;
}

.page-root {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
}
`;

export default function MarketingStyles() {
  const marketingCss = loadMarketingCss();
  const finalCss = marketingCss ? `${marketingCss}\n${coexistenceOverrides}` : "";

  if (!finalCss) {
    return null;
  }

  return (
    <style
      data-marketing
      // Allow server-rendered CSS to differ from the initial client snapshot without warnings.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: finalCss }}
    />
  );
}
