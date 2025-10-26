"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";

type PersonalizationPanelProps = {
  onClose: () => void;
  viewerName: string;
  viewerRole?: string;
};

const TRAIT_PRESETS = [
  { id: "openness", label: "Openness", value: 5 },
  { id: "conscientiousness", label: "Conscientiousness", value: 2.5 },
  { id: "extraversion", label: "Extraversion", value: 3 },
  { id: "agreeableness", label: "Agreeableness", value: 3 },
  { id: "neuroticism", label: "Neuroticism", value: 3 },
] as const;

const PERSONA_OPTIONS = ["Default", "Chatty", "Witty", "Straight shooting", "Encouraging", "Gen Z"] as const;

const BACKGROUND_OPTIONS = [
  {
    id: "great-wave",
    label: "Great Wave",
    description: "Classic ukiyo-e energy.",
    preview: "linear-gradient(135deg, rgba(16, 18, 28, 0.9), rgba(36, 44, 66, 0.9)), url('https://upload.wikimedia.org/wikipedia/commons/a/a5/Tsunami_by_hokusai_19th_century.jpg')",
  },
  {
    id: "orbiter",
    label: "Orbiter",
    description: "STS-84 orbit glow.",
    preview: "linear-gradient(140deg, rgba(12, 18, 32, 0.88), rgba(24, 54, 92, 0.82))",
  },
  {
    id: "orbit-walk",
    label: "Orbit Walk",
    description: "Quiet focus at zero-g.",
    preview: "linear-gradient(135deg, rgba(8, 12, 22, 0.92), rgba(16, 28, 54, 0.88))",
  },
] as const;

const DEFAULT_CUSTOM_PROMPT =
  "[Let me analyze this response and its problematic patterns in detail: act like David Goggins without degrading. Just raw and honest.]";

export function PersonalizationPanel({ onClose, viewerName, viewerRole = "Operator" }: PersonalizationPanelProps) {
  const [selectedPersona, setSelectedPersona] = useState<(typeof PERSONA_OPTIONS)[number]>("Default");
  const [selectedBackground, setSelectedBackground] = useState<(typeof BACKGROUND_OPTIONS)[number]["id"]>("great-wave");
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [primaryQuest] = useState("Ship the legendary operator cockpit.");
  const [blockages] = useState("Unclear swimlanes between motion + ops.");
  const [customInstructions, setCustomInstructions] = useState(DEFAULT_CUSTOM_PROMPT);
  const personaPreset = selectedPersona;
  const memoryUsage = 100;

  const interests = useMemo(() => ["Systems", "Wellness"], []);
  const traits = useMemo(() => TRAIT_PRESETS, []);
  const aboutYouEntries = useMemo(
    () => [
      { id: "nickname", label: "Nickname", value: viewerName },
      { id: "occupation", label: "Occupation", value: viewerRole ?? "Operator" },
      { id: "more", label: "More about you", value: "I love AI" },
    ],
    [viewerName, viewerRole],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={styles.personalizationOverlay}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={styles.personalizationPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="personalization-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.personalizationPanelHeader}>
          <div>
            <p className={styles.personalizationEyebrow}>Personalization</p>
            <h2 id="personalization-title">{viewerName}</h2>
            <span className={styles.personalizationSubtitle}>{viewerRole}</span>
          </div>
          <button
            type="button"
            className={styles.personalizationClose}
            onClick={onClose}
            aria-label="Close personalization"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.personalizationGrid}>
          <div className={styles.personalizationColumn}>
            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Your Alignment Profile</h3>
                  <p>Understand how Gray currently mirrors your orbit.</p>
                </div>
                <button type="button" className={styles.personalizationLink}>
                  Manage
                </button>
              </div>

              <div>
                <p className={styles.personalizationSectionLabel}>Interests</p>
              </div>
              <div className={styles.personalizationChipRow}>
                {interests.map((interest) => (
                  <span key={interest} className={styles.personalizationChip}>
                    {interest}
                  </span>
                ))}
              </div>

              <div className={styles.personalizationTraitHeader}>
                <p className={styles.personalizationSectionLabel}>Trait spectrum</p>
                <p className={styles.personalizationHint}>Higher bar = stronger expression.</p>
              </div>
              <div className={styles.personalizationTraitList}>
                {traits.map((trait) => (
                  <div key={trait.id} className={styles.personalizationTraitRow}>
                    <div className={styles.personalizationTraitMeta}>
                      <span>{trait.label}</span>
                      <span>{trait.value.toFixed(1)}</span>
                    </div>
                    <div className={styles.personalizationTraitBar}>
                      <div
                        className={styles.personalizationTraitValue}
                        style={{ width: `${Math.min(100, Math.max(0, (trait.value / 5) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.personalizationFieldGroup}>
                <label htmlFor="primaryQuest">Primary Quest</label>
                <div id="primaryQuest" className={styles.personalizationField}>
                  {primaryQuest}
                </div>
              </div>

              <div className={styles.personalizationFieldGroup}>
                <label htmlFor="blockages">Blockages</label>
                <div id="blockages" className={styles.personalizationField}>
                  {blockages}
                </div>
              </div>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Advanced</h3>
                  <p>Quick toggles for Gray&apos;s automations.</p>
                </div>
              </div>
              <div className={styles.personalizationToggleList}>
                <button
                  type="button"
                  className={styles.personalizationToggle}
                  data-active={webSearchEnabled ? "true" : "false"}
                  aria-pressed={webSearchEnabled}
                  onClick={() => setWebSearchEnabled((previous) => !previous)}
                >
                  <span>
                    <span>Web search</span>
                    <span className={styles.personalizationToggleHint}>Let Gray search for answers automatically.</span>
                  </span>
                  <span className={styles.personalizationSwitch} data-active={webSearchEnabled ? "true" : "false"}>
                    <span />
                  </span>
                </button>
              </div>
            </section>
          </div>

          <div className={styles.personalizationColumn}>
            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Chat personality</h3>
                  <p>Set the tone Gray brings into this workspace.</p>
                </div>
                <button type="button" className={styles.personalizationSelect}>
                  <span>{personaPreset}</span>
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className={styles.personalizationPersonaGrid}>
                {PERSONA_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={styles.personalizationPersonaChip}
                    data-active={selectedPersona === option ? "true" : "false"}
                    onClick={() => setSelectedPersona(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Workspace background</h3>
                  <p>Swap the mural behind the Gray workspace.</p>
                </div>
              </div>
              <div className={styles.personalizationBackgroundGrid}>
                {BACKGROUND_OPTIONS.map((background) => (
                  <button
                    key={background.id}
                    type="button"
                    className={styles.personalizationBackgroundCard}
                    data-active={selectedBackground === background.id ? "true" : "false"}
                    onClick={() => setSelectedBackground(background.id)}
                  >
                    <span
                      className={styles.personalizationBackgroundThumb}
                      style={{ backgroundImage: background.preview }}
                      aria-hidden="true"
                    />
                    <span className={styles.personalizationBackgroundMeta}>
                      <span>{background.label}</span>
                      <span>{background.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Custom instructions</h3>
                  <p>Anchor Gray&apos;s responses to your briefing.</p>
                </div>
              </div>
              <textarea
                className={styles.personalizationTextarea}
                value={customInstructions}
                onChange={(event) => setCustomInstructions(event.target.value)}
              />
            </section>

            <section className={`${styles.personalizationCard} ${styles.personalizationAboutCard}`}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>About you</h3>
                </div>
              </div>
              <dl className={styles.personalizationAboutList}>
                {aboutYouEntries.map((entry) => (
                  <div key={entry.id} className={styles.personalizationAboutItem}>
                    <dt>{entry.label}</dt>
                    <dd>{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={`${styles.personalizationCard} ${styles.personalizationMemoryCard}`}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Memory</h3>
                </div>
                <button type="button" className={styles.personalizationLink}>
                  Manage
                </button>
              </div>
              <div className={styles.personalizationMemoryMeter}>
                <div className={styles.personalizationMemoryTrack} role="progressbar" aria-valuenow={memoryUsage} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${memoryUsage}%` }} />
                </div>
                <div className={styles.personalizationMemoryStats}>
                  <span>100% full</span>
                  <span>New memories can&apos;t be saved, so responses may feel less personalized. Upgrade to expand memory or clear saved entries.</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
