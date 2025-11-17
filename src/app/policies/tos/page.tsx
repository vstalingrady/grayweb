export const metadata = {
  title: "Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <main className="legal-page">
      <article className="legal-shell legal-article">
        <div className="legal-article__content">
          <section className="legal-hero">
            <p className="legal-meta">Last updated November 2025</p>
            <h1>Terms of Service</h1>
            <p>
              Thank you for choosing Gray. These Terms of Service ("Terms") explain how the Alignment team makes the
              service available, what information we collect, and how you may and may not use the Service. By using Gray, you
              agree to be bound by these Terms.
            </p>
          </section>
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              Gray is provided through Alignment and its affiliates. Accessing or using the Service constitutes your
              acceptance of these Terms. If you do not agree, discontinue use immediately.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              Gray is an AI-powered personal accountability and mentorship application. The Service leverages artificial
              intelligence to offer personalized guidance, check-ins, and feedback based on your goals and behavior patterns.
            </p>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <ul>
              <li>You are responsible for keeping your credentials confidential.</li>
              <li>Provide accurate registration information and keep it up to date.</li>
              <li>You assume responsibility for all activity that occurs under your account.</li>
            </ul>
          </section>

          <section>
            <h2>4. Acceptable Use</h2>
            <BulletList
              items={[
                "Use the Service lawfully and in a manner that does not infringe others’ rights.",
                "Do not harass, abuse, or harm other users or attempt to gain unauthorized access.",
                "Do not reverse engineer the Service or use it to build competing products without permission.",
                "Do not share your account credentials with others.",
              ]}
            />
          </section>

          <section>
            <h2>5. Data Collection and Usage</h2>
            <p>We collect the following data to deliver Gray:</p>
            <BulletList
              items={[
                "Account information (name, email, profile details).",
                "Interactions with Gray (check-ins, goals, messages, patterns).",
                "Usage analytics (features used, frequency, engagement).",
                "Device and system metadata.",
              ]}
            />
            <p>We use your data for:</p>
            <ul>
              <li>Required service delivery (storing goals, remembering preferences, generating responses).</li>
              <li>Product improvement (opt-in): you may opt in to share anonymized, aggregated data to improve Gray.</li>
              <li>Legal compliance and safety when required.</li>
            </ul>
            <p>
              Do not share sensitive health, financial, or other highly confidential data. Gray is not HIPAA-compliant and
              is not a substitute for professional mental health services.
            </p>
          </section>

          <section>
            <h2>6. Data Privacy &amp; Security</h2>
            <BulletList
              items={[
                "We encrypt data in transit and at rest.",
                "We do not sell your personal data.",
                "We retain data while your account is active and for a limited period afterward.",
                "Our team is assessing compliance with regional privacy frameworks; we do not yet claim full compliance.",
                "AI responses currently run on Gray-controlled infrastructure; we do not share your prompts with external AI vendors.",
              ]}
            />
          </section>

          <section>
            <h2>7. Limitations of Liability</h2>
            <p>
              Gray is provided “as is” without warranties. We cannot guarantee uninterrupted service or accuracy of AI
              guidance. You are responsible for evaluating any advice and for decisions you make.
            </p>
            <BulletList
              items={[
                "We are not liable for data loss, interruptions, or decisions you make based on Gray’s output.",
                "Indirect, consequential, or exemplary damages are not recoverable to the fullest extent permitted by law.",
                "Our maximum liability is limited to the amount you paid in the past 12 months for the Service.",
              ]}
            />
          </section>

          <section>
            <h2>8. Disclaimers</h2>
            <p>
              Gray is not a replacement for professional mental health, medical, or legal advice. If you are experiencing
              a mental health crisis, contact emergency services or a licensed professional.
            </p>
            <p>AI outputs may be inaccurate; you remain responsible for any actions taken.</p>
          </section>

          <section>
            <h2>9. Intellectual Property</h2>
            <p>
              You retain ownership of the content you create. You grant Alignment a license to use that content to
              improve the Service and train AI models, subject to your privacy preferences.
            </p>
          </section>

          <section>
            <h2>10. Termination</h2>
            <p>
              We may terminate or suspend your account for any reason, including violations of these Terms. You may delete
              your account any time; we will remove your personal data within a reasonable period unless retention is required
              by law.
            </p>
          </section>

          <section>
            <h2>11. Changes to Terms</h2>
            <p>We may update these Terms at any time. Material changes will be communicated via email when possible.</p>
          </section>

          <section>
            <h2>12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Indonesia, and disputes will be resolved in the courts of Jakarta
              unless another forum is mutually agreed upon.
            </p>
          </section>

          <section>
            <h2>13. Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a className="legal-contact" href="mailto:legal@alignment.id">
                legal@alignment.id
              </a>
              .
            </p>
          </section>

        </div>
      </article>
    </main>
  );
}

type ListProps = {
  items: string[];
};

const BulletList = ({ items }: ListProps) => (
  <ul className="tos-bullet-list">
    {items.map((item) => (
      <li key={item} className="tos-bullet-item">{item}</li>
    ))}
  </ul>
);
