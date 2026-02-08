"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";

type ImageLightboxProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  caption?: string;
};

export default function ImageLightbox({ src, alt, width, height, className, caption }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rafId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, closeModal]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="group block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label={`Open preview: ${alt}`}
      >
        <Image src={src} alt={alt} width={width} height={height} className={className ?? "h-auto w-full object-cover"} />
      </button>
      {caption ? (
        <figcaption className="px-4 py-3 text-center text-sm text-white/60">{caption}</figcaption>
      ) : null}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              className="h-auto w-auto max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
              priority
            />
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeModal}
              aria-label="Close preview"
              className="absolute -right-3 -top-3 rounded-full bg-white/90 px-2 py-1 text-black shadow"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
