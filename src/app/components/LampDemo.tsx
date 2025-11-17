import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LampDemoProps = {
  className?: string;
  children?: ReactNode;
};

export function LampDemo({ className, children }: LampDemoProps) {
  return (
    <LampContainer className={cn("pointer-events-none ml-auto h-full w-full max-w-[60rem] select-none", className)}>
      {children}
    </LampContainer>
  );
}

type LampContainerProps = {
  children?: ReactNode;
  className?: string;
};

export const LampContainer = ({ children, className }: LampContainerProps) => (
  <div
    className={cn(
      "relative z-0 flex h-full min-h-[520px] w-full flex-col items-center justify-center overflow-hidden rounded-l-[90px] bg-slate-950/90 shadow-[0_40px_140px_rgba(0,0,0,0.65)]",
      className
    )}
  >
    {children ? <div className="relative z-50 flex -translate-y-72 flex-col items-center px-5">{children}</div> : null}
  </div>
);
