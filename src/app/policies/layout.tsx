import type { ReactNode } from "react";
import MarketingStyles from "@/app/components/MarketingStyles";
import Navigation from "@/app/components/Navigation";

export default function PoliciesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingStyles />
      <div className="page-root">
        <Navigation />
        {children}
      </div>
    </>
  );
}
