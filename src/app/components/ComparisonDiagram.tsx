import Image from "next/image";
import MockChatInterface from "./MockChatInterface";

const UserIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const RobotIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="6" y="9" width="12" height="8" rx="2" />
    <path d="M9 5h6" />
    <path d="M12 5V3" />
    <path d="M9 17v2" />
    <path d="M15 17v2" />
    <circle cx="9.5" cy="12.5" r="0.9" />
    <circle cx="14.5" cy="12.5" r="0.9" />
    <path d="M8 9V7" />
    <path d="M16 9V7" />
  </svg>
);

const FlowArrow = ({ className = "" }: { className?: string }) => (
  <svg
    className={`contrast-arrow ${className}`}
    viewBox="0 0 120 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 16h96" />
    <path d="M92 8l8 8-8 8" />
  </svg>
);

const wrapperPainPoints = [
  "One-way prompts. No shared goals, no proactive follow-up.",
  "Stateless chats that forget every ritual as soon as you close the tab.",
  "UI debt everywhere—bolted-on dashboards that break the moment you need them.",
];

const grayAdvantages = [
  "Gray keeps score for you—rituals, mood, cadence—all in a living second brain.",
  "The Gray crest routes insights back to you with accountability, not alerts.",
  "Human-first choreography: partners, prompts, and playbooks tuned to your orbit.",
];

const ComparisonDiagram = () => (
  <section id="depth" className="comparison-section section-shell">
    <div className="contrast-shell">
      <header className="contrast-header">
        <span className="badge badge--amber">Why Gray</span>
        <h2 className="contrast-heading text-balance">Wrappers wait. Gray works the problem with you.</h2>
        <p className="contrast-subheading text-balance">
          We rebuilt the assistant workflow so the burden of momentum, memory, and emotional context rests on the system—not on the human doing the work.
        </p>
      </header>

      <div className="contrast-grid">
        <article className="contrast-card contrast-card--wrapper">
          <header className="contrast-card__masthead">
            <div className="contrast-flow">
              <div className="contrast-flow__icon">
                <UserIcon />
              </div>
              <FlowArrow />
              <div className="contrast-flow__icon contrast-flow__icon--robot">
                <RobotIcon />
              </div>
            </div>
            <div>
              <div className="contrast-chip">Typical GPT Wrapper</div>
              <p>Cobbled together dashboards that still leave you solo.</p>
            </div>
          </header>

          <div className="contrast-visual contrast-visual--error">
            <div className="contrast-visual__placeholder" aria-hidden />
          </div>

          <ul className="contrast-list text-[0.9rem] opacity-90">
            {wrapperPainPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <footer className="contrast-footer text-xs opacity-70">Feels like a prettier terminal—still your job to remember everything.</footer>
        </article>

        <article className="contrast-card contrast-card--gray">
          <header className="contrast-card__masthead">
            <div className="contrast-logo">
              <Image src="/grayaiwhite.svg" alt="Gray logo" width={132} height={132} />
            </div>
            <div>
              <div className="contrast-chip contrast-chip--glow">Gray: Symbiotic Companion</div>
              <p>Intelligent choreography that keeps your intentional life in motion.</p>
            </div>
          </header>

          <div className="contrast-flow contrast-flow--gray">
            <div className="contrast-flow__icon">
              <UserIcon />
            </div>
            <FlowArrow className="contrast-arrow--glow" />
            <div className="contrast-flow__logo">
              <Image src="/grayaiwhite.svg" alt="Gray crest" fill sizes="72px" />
            </div>
            <FlowArrow className="contrast-arrow--glow contrast-arrow--reverse" />
            <div className="contrast-flow__icon contrast-flow__icon--return">
              <UserIcon />
            </div>
          </div>

          <div className="contrast-visual contrast-visual--gray p-0 overflow-hidden relative">
            <MockChatInterface />
          </div>

          <ul className="contrast-list contrast-list--bright">
            {grayAdvantages.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <footer className="contrast-footer contrast-footer--bright">
            Partnership, not prompts. Gray carries the rituals so you can pursue the work.
          </footer>
        </article>
      </div>
    </div>
  </section>
);

export default ComparisonDiagram;
