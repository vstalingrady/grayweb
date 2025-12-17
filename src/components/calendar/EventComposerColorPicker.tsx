import type { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from "react";

import { Plus } from "lucide-react";

import styles from "./GrayDashboardCalendar.module.css";
import {
  EARTHY_PALETTE,
  hexToRgb,
  NEUTRAL_PALETTE,
  PASTEL_PALETTE,
  QUICK_COLOR_SWATCHES,
  rgbToHex,
} from "./eventComposerUtils";
import { useI18n } from "@/contexts/I18nContext";

type EventComposerColorPickerProps = {
  color: string;
  isColorPickerOpen: boolean;
  setIsColorPickerOpen: Dispatch<SetStateAction<boolean>>;
  hexDraft: string;
  setHexDraft: Dispatch<SetStateAction<string>>;
  colorPopoverStyle: CSSProperties | undefined;
  colorPickerRef: MutableRefObject<HTMLDivElement | null>;
  colorPickerTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  colorPickerPopoverRef: MutableRefObject<HTMLDivElement | null>;
  onSelectColor: (colorValue: string) => void;
  onUpdateColorWithoutClosing: (colorValue: string) => void;
  onHexCommit: () => void;
};

export function EventComposerColorPicker({
  color,
  isColorPickerOpen,
  setIsColorPickerOpen,
  hexDraft,
  setHexDraft,
  colorPopoverStyle,
  colorPickerRef,
  colorPickerTriggerRef,
  colorPickerPopoverRef,
  onSelectColor,
  onUpdateColorWithoutClosing,
  onHexCommit,
}: EventComposerColorPickerProps) {
  const { t } = useI18n();

  const isQuickSwatch = QUICK_COLOR_SWATCHES.includes(
    color as (typeof QUICK_COLOR_SWATCHES)[number],
  );
  const rgb = hexToRgb(color) ?? { red: 0, green: 0, blue: 0 };

  return (
    <div className={styles.composerColors} ref={colorPickerRef}>
      <div className={styles.composerQuickSwatches}>
        {QUICK_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={styles.composerColorDot}
            style={{ backgroundColor: swatch }}
            data-active={color === swatch ? "true" : "false"}
            onClick={() => onSelectColor(swatch)}
            aria-label={t("Select {color} color", { color: swatch })}
          />
        ))}
      </div>
      <button
        type="button"
        className={styles.composerColorDot}
        data-active={isQuickSwatch ? "false" : "true"}
        onClick={() => setIsColorPickerOpen((previous) => !previous)}
        aria-label={t("Pick custom color")}
        aria-expanded={isColorPickerOpen ? "true" : "false"}
        ref={colorPickerTriggerRef}
      >
        <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {isColorPickerOpen ? (
        <div
          ref={colorPickerPopoverRef}
          className={styles.composerColorPopover}
          style={colorPopoverStyle}
          role="dialog"
          aria-label={t("Color picker")}
        >
          <div className={styles.composerColorPopoverHeader}>
            <div
              className={styles.composerColorPreview}
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <label className={styles.composerColorHexLabel}>
              <span>HEX</span>
              <input
                value={hexDraft}
                onChange={(event) => setHexDraft(event.target.value)}
                onBlur={onHexCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onHexCommit();
                  }
                }}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>

          <div className={styles.composerColorSliders} aria-label={t("RGB sliders")}>
            <label>
              <span>R</span>
              <input
                type="range"
                min={0}
                max={255}
                value={rgb.red}
                onChange={(event) =>
                  onUpdateColorWithoutClosing(
                    rgbToHex(Number(event.target.value), rgb.green, rgb.blue),
                  )
                }
              />
              <output>{rgb.red}</output>
            </label>
            <label>
              <span>G</span>
              <input
                type="range"
                min={0}
                max={255}
                value={rgb.green}
                onChange={(event) =>
                  onUpdateColorWithoutClosing(
                    rgbToHex(rgb.red, Number(event.target.value), rgb.blue),
                  )
                }
              />
              <output>{rgb.green}</output>
            </label>
            <label>
              <span>B</span>
              <input
                type="range"
                min={0}
                max={255}
                value={rgb.blue}
                onChange={(event) =>
                  onUpdateColorWithoutClosing(
                    rgbToHex(rgb.red, rgb.green, Number(event.target.value)),
                  )
                }
              />
              <output>{rgb.blue}</output>
            </label>
          </div>

          <div className={styles.composerColorPaletteSection}>
            <h3>Earthy</h3>
            <div className={styles.composerColorPaletteGrid}>
              {EARTHY_PALETTE.map((swatch) => (
                <button
                  key={`earthy-${swatch}`}
                  type="button"
                  className={styles.composerColorSwatch}
                  style={{ backgroundColor: swatch }}
                  data-active={color === swatch ? "true" : "false"}
                  onClick={() => onSelectColor(swatch)}
                  aria-label={t("Select {color} color", { color: swatch })}
                />
              ))}
            </div>
          </div>

          <div className={styles.composerColorPaletteSection}>
            <h3>Pastel</h3>
            <div className={styles.composerColorPaletteGrid}>
              {PASTEL_PALETTE.map((swatch) => (
                <button
                  key={`pastel-${swatch}`}
                  type="button"
                  className={styles.composerColorSwatch}
                  style={{ backgroundColor: swatch }}
                  data-active={color === swatch ? "true" : "false"}
                  onClick={() => onSelectColor(swatch)}
                  aria-label={t("Select {color} color", { color: swatch })}
                />
              ))}
            </div>
          </div>

          <div className={styles.composerColorPaletteSection}>
            <h3>Neutrals</h3>
            <div className={styles.composerColorPaletteGrid}>
              {NEUTRAL_PALETTE.map((swatch) => (
                <button
                  key={`neutral-${swatch}`}
                  type="button"
                  className={styles.composerColorSwatch}
                  style={{ backgroundColor: swatch }}
                  data-active={color === swatch ? "true" : "false"}
                  onClick={() => onSelectColor(swatch)}
                  aria-label={t("Select {color} color", { color: swatch })}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
