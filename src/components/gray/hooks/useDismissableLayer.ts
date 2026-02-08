import { useEffect, type RefObject } from "react";

type UseDismissableLayerOptions = {
  isOpen: boolean;
  ignoreRefs: ReadonlyArray<RefObject<HTMLElement | null>>;
  onDismiss: () => void;
  onEscape?: () => void;
  focusTrapRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const getFocusableElements = (element: HTMLElement) => {
  return Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((node) => {
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  });
};

export const useDismissableLayer = ({
  isOpen,
  ignoreRefs,
  onDismiss,
  onEscape,
  focusTrapRef,
  returnFocusRef,
}: UseDismissableLayerOptions) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTrapElement = focusTrapRef?.current ?? null;
    const returnFocusElement = returnFocusRef?.current ?? null;
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (focusTrapElement) {
      const focusable = getFocusableElements(focusTrapElement);
      const firstFocusable = focusable[0];
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        focusTrapElement.focus();
      }
    }

    const handlePointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      for (const ref of ignoreRefs) {
        const element = ref.current;
        if (element && element.contains(target)) {
          return;
        }
      }

      onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && focusTrapElement) {
        const focusable = getFocusableElements(focusTrapElement);
        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];
        const activeElement = document.activeElement as HTMLElement | null;

        if (!firstFocusable || !lastFocusable) {
          event.preventDefault();
          focusTrapElement.focus();
          return;
        }

        if (!activeElement || !focusTrapElement.contains(activeElement)) {
          event.preventDefault();
          (event.shiftKey ? lastFocusable : firstFocusable).focus();
          return;
        }

        if (!event.shiftKey && activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
          return;
        }

        if (event.shiftKey && activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
          return;
        }
      }

      if (event.key !== "Escape") {
        return;
      }

      if (onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      event.preventDefault();
      onDismiss();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);

      if (focusTrapElement || returnFocusElement) {
        const focusTarget = returnFocusElement ?? previouslyFocusedElement;
        if (focusTarget && document.contains(focusTarget)) {
          focusTarget.focus();
        }
      }
    };
  }, [focusTrapRef, ignoreRefs, isOpen, onDismiss, onEscape, returnFocusRef]);
};
