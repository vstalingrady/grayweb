import { useEffect, type RefObject } from "react";

type UseDismissableLayerOptions = {
  isOpen: boolean;
  ignoreRefs: ReadonlyArray<RefObject<HTMLElement | null>>;
  onDismiss: () => void;
  onEscape?: () => void;
};

export const useDismissableLayer = ({
  isOpen,
  ignoreRefs,
  onDismiss,
  onEscape,
}: UseDismissableLayerOptions) => {
  useEffect(() => {
    if (!isOpen) {
      return;
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
      if (event.key !== "Escape") {
        return;
      }
      if (onEscape) {
        onEscape();
        return;
      }
      onDismiss();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ignoreRefs, isOpen, onDismiss, onEscape]);
};
