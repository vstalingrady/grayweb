import HeroSection from "./components/HeroSection";
import Navigation from "./components/Navigation";
import ComparisonDiagram from "./components/ComparisonDiagram";
import FadeInSection from "./components/FadeInSection";
import FooterBackground from "./components/FooterBackground";
import MarketingStyles from "./components/MarketingStyles";

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 5 6v5c0 5 3 9 7 11 4-2 7-6 7-11V6l-7-3Z" />
  </svg>
);

const BranchesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3v4a2 2 0 0 0 2 2h3" />
    <path d="M18 21v-4a2 2 0 0 0-2-2h-3" />
    <circle cx="18" cy="3" r="2" />
    <circle cx="6" cy="21" r="2" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

const MentorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19h16" />
    <path d="M4 5h16" />
    <path d="M7 19V5" />
    <path d="M17 19V5" />
    <path d="M10.5 10.5h3" />
    <path d="M10.5 14h3" />
  </svg>
);

const ConnectIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="12" r="3" />
    <circle cx="19" cy="5" r="3" />
    <circle cx="19" cy="19" r="3" />
    <path d="M7.6 10.4 16.4 6.6" />
    <path d="M7.6 13.6 16.4 17.4" />
  </svg>
);

const CoachIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="m19.4 7-3.5 2" />
    <path d="m8.1 15-3.5 2" />
    <path d="m19.4 17-3.5-2" />
    <path d="m8.1 9-3.5-2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CompassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m16 8-2 6-6 2 2-6 6-2Z" />
  </svg>
);

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
    <path d="m7 21 10-18" />
    <path d="M7 3 5 5" />
    <path d="m19 19-2 2" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="site-footer__icon" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
    <path d="M7.5 7.5h0" />
    <circle cx="12" cy="12" r="3.5" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" className="site-footer__icon" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
    <path d="m3 7 7.92 5.28a2 2 0 0 0 2.16 0L21 7" />
  </svg>
);

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" className="site-footer__icon" aria-hidden>
    <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
    <path d="M8 11v5" />
    <path d="M8 8v.01" />
    <path d="M12 16v-5" />
    <path d="M16 16v-3a2 2 0 0 0-4 0" />
  </svg>
);

export default function Home() {
  return (
    <>
      <MarketingStyles />
      <div className="page-root">
        <Navigation />
        <HeroSection />
        <FadeInSection>
          <div className="page-main-wrapper">
            <ComparisonDiagram />

            <main className="page-main">
            <section id="values" className="section-shell section-padding">
              <div className="section-intro">
                <span className="badge">Our Values</span>
                <h2 className="section-heading text-balance">
                  Technology should amplify intention, never impulse.
                </h2>
                <p className="section-subheading text-balance">
                  We build companions that defend attention, protect autonomy, and nurture meaning in the
                  lives they touch.
                </p>
              </div>
              <div className="values-grid">
                <article className="value-card card-surface">
                  <h3 className="value-title">Focus is sacred</h3>
                  <p>
                    Every supernormal stimulus we subtract creates room for deliberate work. Our systems
                    learn the rhythms that keep you clear, then shield them with quiet guardrails.
                  </p>
                  <p>
                    We design for depth—not dopamine—so the signal of your best ideas can cut through the
                    noise that competes for your attention.
                  </p>
                </article>
                <article className="value-card card-surface">
                  <h3 className="value-title">Sovereignty is default</h3>
                  <p>
                    You own the cadence, the memory, and the model. Our role is to make the machinery
                    transparent, auditable, and easy to bend toward your personal definition of progress.
                  </p>
                  <p>
                    Alignment is not obedience to a universal standard—it is relentless fidelity to the
                    human author steering the system.
                  </p>
                </article>
                <article className="value-card card-surface">
                  <h3 className="value-title">Compassion is infrastructure</h3>
                  <p>
                    Humane technology should feel like a partner, not a taskmaster. We encode empathy into
                    the feedback loops so guidance arrives as invitation, never coercion.
                  </p>
                  <p>
                    The goal is simple: help the best in you emerge more often, with tools that respond to
                    your energy, your story, and your capacity.
                  </p>
                </article>
              </div>
            </section>

          <section id="gray" className="section-shell section-padding">
            <div className="section-intro">
              <span className="badge">Gray</span>
              <h2 className="section-heading text-balance">A LifeOS that keeps your intention in orbit.</h2>
              <p className="section-subheading text-balance">
                Gray lives inside a private Discord server, quietly orchestrating rituals, knowledge, and
                integrations so you can stay locked on the work that matters.
              </p>
            </div>
            <div className="gray-layout">
              <article className="gray-panel card-surface">
                <p className="panel-label">Presence</p>
                <h3 className="panel-title">What Gray defends</h3>
                <p>
                  The moment you invite Gray, it spins up a sovereign workspace—your own server, your
                  own cadence. Every proactive move is logged, explainable, and tuned to your rituals.
                </p>
                <ul className="gray-list">
                  <li>
                    <span className="list-icon list-icon--accent">
                      <ShieldIcon />
                    </span>
                    <span>Instant sanctuary creation with BYOK privacy.</span>
                  </li>
                  <li>
                    <span className="list-icon">
                      <BranchesIcon />
                    </span>
                    <span>Context threads that remember goals, not gossip.</span>
                  </li>
                  <li>
                    <span className="list-icon">
                      <ClockIcon />
                    </span>
                    <span>Proactive nudges scheduled to your rhythms, not someone else’s roadmap.</span>
                  </li>
                </ul>
              </article>
              <article className="gray-panel card-surface">
                <p className="panel-label">Momentum</p>
                <h3 className="panel-title">How we’re evolving it</h3>
                <ul className="gray-list">
                  <li>
                    <span className="list-icon list-icon--accent">
                      <MentorIcon />
                    </span>
                    <span>Democratized mentorship—an always-on Socratic advisor tuned to your goals.</span>
                  </li>
                  <li>
                    <span className="list-icon">
                      <ConnectIcon />
                    </span>
                    <span>The Connect Engine that pairs ambition with collaborators, not status with status.</span>
                  </li>
                  <li>
                    <span className="list-icon">
                      <CoachIcon />
                    </span>
                    <span>A proactive coach that reinforces belief, momentum, and disciplined execution.</span>
                  </li>
                </ul>
              </article>
            </div>
          </section>

          <section id="vision" className="section-shell section-padding">
            <div className="section-intro">
              <span className="badge">Vision</span>
              <h2 className="section-heading text-balance">Shattering the accident of birth.</h2>
              <p className="section-subheading text-balance">
                alignment.id exists to make the invisible curriculum visible to everyone. Potential is
                universal; opportunity should be too.
              </p>
            </div>
            <div className="vision-grid">
              <article className="vision-panel card-surface">
                <h3 className="vision-title">The inherited system</h3>
                <p>
                  For millennia, the greatest predictors of success have been wealth, proximity, and the
                  elite networks you were born into. Access to mentorship, capital, and belief was guarded
                  by the lucky accident of birth.
                </p>
                <p>
                  Those outside the circle were left guessing—without guidance, without feedback, and
                  without the invisible curriculum that teaches you how to navigate power, build
                  companies, or lead with conviction.
                </p>
              </article>
              <article className="vision-panel card-surface">
                <h3 className="vision-title">Gray: the great equalizer</h3>
                <ul className="vision-list">
                  <li>
                    <span className="list-icon list-icon--accent">
                      <MentorIcon />
                    </span>
                    <div>
                      <strong>Democratized mentorship.</strong> Gray compresses the world’s playbooks into a
                      patient Socratic partner that asks better questions than any private club.
                    </div>
                  </li>
                  <li>
                    <span className="list-icon list-icon--accent">
                      <ConnectIcon />
                    </span>
                    <div>
                      <strong>The Connect feature.</strong> A serendipity engine that links ambition to
                      ambition, pairing isolated builders regardless of geography or pedigree.
                    </div>
                  </li>
                  <li>
                    <span className="list-icon list-icon--accent">
                      <CoachIcon />
                    </span>
                    <div>
                      <strong>The Proactive Coach.</strong> A relentless champion that reinforces the growth
                      mindset, celebrates compounding effort, and keeps cynicism at bay.
                    </div>
                  </li>
                </ul>
              </article>
              <article className="vision-panel card-surface">
                <h3 className="vision-title">The mission we refuse to lose</h3>
                <p>
                  alignment.id is built on the belief that potential belongs to everyone. Gray is the
                  weapon we are forging to ensure that the next great founder, scientist, or artist is not
                  constrained by a birth lottery, but unleashed by an aligned, personal, and democratic
                  intelligence.
                </p>
                <p>
                  The Great Inversion of AI—machines mastering creative work while humans are left to toil—
                  does not have to happen. Gray keeps intellect, strategy, and meaning in human hands.
                </p>
                <ul className="vision-list">
                  <li>
                    <span className="list-icon list-icon--accent">
                      <CoachIcon />
                    </span>
                    <div>
                      <strong>Infinite learner.</strong> Spaced repetition that turns threatened skills into
                      future-proof capabilities at unprecedented speed.
                    </div>
                  </li>
                  <li>
                    <span className="list-icon list-icon--accent">
                      <CompassIcon />
                    </span>
                    <div>
                      <strong>Personal strategist.</strong> A proactive coach that maps market shifts to your
                      own ambitions and suggests the next roles you’re built to inhabit.
                    </div>
                  </li>
                  <li>
                    <span className="list-icon list-icon--accent">
                      <SparkIcon />
                    </span>
                    <div>
                      <strong>Second brain.</strong> Gray manages overload so your mind stays free to dream,
                      create, and lead—turning human–AI collaboration into symbiosis.
                    </div>
                  </li>
                </ul>
                <p className="vision-tagline">This isn’t just a good idea. It’s a just one.</p>
              </article>
            </div>
          </section>

          <section id="company" className="section-shell section-padding">
            <div className="section-intro">
              <span className="badge">Company</span>
              <h2 className="section-heading text-balance">We design humane systems for intentional people.</h2>
              <p className="section-subheading text-balance">
                alignment.id articulates the values. Gray delivers the practice. Together they form a
                living antidote to distraction—principles encoded as daily rituals.
              </p>
            </div>
            <div className="symbiosis-grid">
              <div className="symbiosis-panel card-surface">
                <p className="panel-label">alignment.id</p>
                <h3 className="panel-title">The philosophy engine</h3>
                <p>
                  Our values define the guardrails: reverence for human sovereignty, intentional
                  attention, and humane design. They are the compass that keeps every product decision,
                  every interface, and every ritual aligned to human flourishing.
                </p>
                <ul className="symbiosis-list">
                  <li>Design language tuned for calm focus.</li>
                  <li>Ethics rooted in agency, not engagement metrics.</li>
                  <li>Systems that default to your cadence and values.</li>
                </ul>
              </div>
              <div className="symbiosis-panel card-surface">
                <p className="panel-label">Gray</p>
                <h3 className="panel-title">The intentional companion</h3>
                <p>
                  Gray operationalizes the values. It is a proactive Discord-native companion that
                  curates knowledge, architects habits, and orchestrates integrations in service of your
                  definition of progress. It nudges, reflects, and remembers—always with your consent.
                </p>
                <ul className="symbiosis-list">
                  <li>Personal sanctuary spun instantly from a private Discord server.</li>
                  <li>Modular cognition: cogs for memory, habits, integrations, and beyond.</li>
                  <li>Explainable, inspectable state so you always know why it acts.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="workshop" className="section-shell section-padding">
            <div className="section-intro">
              <span className="badge">Workshops</span>
              <h2 className="section-heading text-balance">Free AI workshops for high school students.</h2>
              <p className="section-subheading text-balance">
                We are bringing alignment.id into classrooms this fall—hands-on sessions that teach
                intentional creation, ethical guardrails, and how to wield AI without losing focus.
              </p>
            </div>
            <div className="gray-layout">
              <article className="gray-panel card-surface">
                <p className="panel-label">Curriculum</p>
                <h3 className="panel-title">What students experience</h3>
                <ul className="gray-list">
                  <li>
                    <span className="list-icon">
                      <CompassIcon />
                    </span>
                    <span>Signal vs. noise: rituals for focused research and study.</span>
                  </li>
                  <li>
                    <span className="list-icon">
                      <ShieldIcon />
                    </span>
                    <span>Ethical prompts: designing bots that respect agency and privacy.</span>
                  </li>
                  <li>
                    <span className="list-icon">
                      <SparkIcon />
                    </span>
                    <span>Project studio: teams build a personal LifeOS blueprint with Gray.</span>
                  </li>
                </ul>
              </article>
              <article className="gray-panel card-surface">
                <p className="panel-label">Partners</p>
                <h3 className="panel-title">Invite us to your school</h3>
                <p>
                  We’re scheduling on-site and virtual workshops across the fall semester. Sessions are
                  free; we simply ask schools to provide a learning space and a group ready to build.
                </p>
                <div className="contact-links">
                  <a href="mailto:hello@alignment.id" className="contact-link">
                    Request A Date
                  </a>
                </div>
              </article>
            </div>
          </section>

          <section id="company" className="section-shell section-padding">
            <div className="section-intro">
              <span className="badge">Company</span>
              <h2 className="section-heading text-balance">We design humane systems for intentional people.</h2>
              <p className="section-subheading text-balance">
                alignment.id articulates the values. Gray delivers the practice. Together they form a
                living antidote to distraction—principles encoded as daily rituals.
              </p>
            </div>
            <div className="symbiosis-grid">
              <div className="symbiosis-panel card-surface">
                <p className="panel-label">alignment.id</p>
                <h3 className="panel-title">The philosophy engine</h3>
                <p>
                  Our values define the guardrails: reverence for human sovereignty, intentional
                  attention, and humane design. They are the compass that keeps every product decision,
                  every interface, and every ritual aligned to human flourishing.
                </p>
                <ul className="symbiosis-list">
                  <li>Design language tuned for calm focus.</li>
                  <li>Ethics rooted in agency, not engagement metrics.</li>
                  <li>Systems that default to your cadence and values.</li>
                </ul>
              </div>
              <div className="symbiosis-panel card-surface">
                <p className="panel-label">Gray</p>
                <h3 className="panel-title">The intentional companion</h3>
                <p>
                  Gray operationalizes the values. It is a proactive Discord-native companion that
                  curates knowledge, architects habits, and orchestrates integrations in service of your
                  definition of progress. It nudges, reflects, and remembers—always with your consent.
                </p>
                <ul className="symbiosis-list">
                  <li>Personal sanctuary spun instantly from a private Discord server.</li>
                  <li>Modular cognition: cogs for memory, habits, integrations, and beyond.</li>
                  <li>Explainable, inspectable state so you always know why it acts.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="field-notes" className="section-shell section-padding">
            <div className="section-intro">
              <span className="badge">Field Notes</span>
              <h2 className="section-heading text-balance">Engineering the supernormal antidote</h2>
              <p className="section-subheading text-balance">
                Our workbench is where philosophy meets implementation—a ritual of scanning inputs,
                detecting friction, and composing new guardrails that protect the best in us.
              </p>
            </div>
          </section>
          </main>
        </div>
      </FadeInSection>

      <footer id="contact" className="site-footer">
        <FooterBackground />
        <div className="site-footer__overlay">
          <p className="site-footer__title">alignment.id</p>
          <p className="site-footer__tagline">We defend focus, sovereignty, and compassion.</p>
          <p className="site-footer__summary">
            Anchoring humane technology that honours human agency. Gray orbits every routine so focus
            stays sovereign, and intention guides every companion we build.
          </p>
          <div className="site-footer__socials" aria-label="Social links">
            <a href="#" className="site-footer__icon-link" aria-label="Instagram">
              <InstagramIcon />
            </a>
            <a href="mailto:hello@alignment.id" className="site-footer__icon-link" aria-label="Email">
              <MailIcon />
            </a>
            <a href="#" className="site-footer__icon-link" aria-label="LinkedIn">
              <LinkedinIcon />
            </a>
          </div>
          <p className="site-footer__meta">© {new Date().getFullYear()} alignment.id. All rights reserved.</p>
        </div>
      </footer>
    </div>
    </>
  );
}
