import type { ReactNode } from "react";
import Navigation from "@/app/components/Navigation";

export default function TermsOfServiceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-root">
      <Navigation />
      {children}
    </div>
  );
}