import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "January 2025";

type ListProps = {
  items: string[];
};

const BulletList = ({ items }: ListProps) => (
  <ul>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <section>
        <h1>Privacy Policy</h1>
        <p>Last updated: {LAST_UPDATED}</p>
        <p>
          This Privacy Policy explains how we collect, use, and safeguard information when you
          interact with the Alignment Gray workspace (the “Service”). By using the Service, you
          agree to the practices described below.
        </p>
      </section>

      <section>
        <h2>Information We Collect</h2>
        <BulletList
          items={[
            "Account details such as email address, display name, and profile image supplied via Supabase authentication.",
            "Workspace content you create, including chat sessions, AI conversation history, plans, habits, and calendar events.",
            "Service metadata (for example timestamps, device/region inferred from IP address, and status logs) used to deliver core functionality and maintain system health.",
            "Files you upload to share with the Gemini assistant, limited to the size thresholds documented in the app.",
          ]}
        />
      </section>

      <section>
        <h2>How We Use Information</h2>
        <BulletList
          items={[
            "Authenticate you securely and keep your session active inside the Gray dashboard.",
            "Personalise the experience with your preferred name, avatar, and workspace context.",
            "Generate AI responses powered by Google Gemini, including optional attachment analysis when you choose to upload files.",
            "Persist conversation history, plans, habits, and calendar data so you can revisit prior work across sessions.",
            "Monitor reliability, debug issues, and protect the Service against misuse or abuse.",
          ]}
        />
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>We rely on carefully selected processors to operate the Service:</p>
        <BulletList
          items={[
            "Supabase (authentication, profile storage, and conversation persistence).",
            "Google Gemini (AI responses and file analysis).",
            "Google Calendar APIs (when you connect your calendar to sync events).",
            "Hosting and infrastructure providers required to run the FastAPI backend and Next.js frontend.",
          ]}
        />
        <p>
          Each provider processes data on our behalf under contractual terms. Where required, we
          enter data processing agreements and apply the security controls they support.
        </p>
      </section>

      <section>
        <h2>Data Storage &amp; Retention</h2>
        <BulletList
          items={[
            "Account and conversation data is stored in managed databases provisioned through Supabase or the project-maintained PostgreSQL instance.",
            "Uploaded files for Gemini are stored temporarily only for analysis and are deleted according to the limits defined in the backend service.",
            "Backups and diagnostics logs are retained for as long as necessary to operate, secure, and improve the Service.",
            "You may request deletion of your profile or chat history by contacting us; we will erase the requested data unless law or legitimate business needs require retention.",
          ]}
        />
      </section>

      <section>
        <h2>Your Choices &amp; Rights</h2>
        <BulletList
          items={[
            "You can update your profile details at any time from the account settings inside the app.",
            "You may disconnect calendar access through the Google permissions dashboard or by removing the integration in the Service.",
            "You have the right to request a copy of your personal data, ask for corrections, or request deletion, subject to applicable law.",
          ]}
        />
        <p>
          Please reach out to us using the contact details below to exercise these rights. We may
          need to verify your identity before fulfilling certain requests.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We apply administrative, technical, and physical safeguards designed to protect your
          information. These controls include encrypted transport (HTTPS), access restrictions,
          least-privilege credentials for infrastructure, and regular reviews of dependency and
          configuration security. No online service can guarantee absolute security, but we work
          continuously to keep the Service safe.
        </p>
      </section>

      <section>
        <h2>International Data Transfers</h2>
        <p>
          Depending on your location, your information may be processed in jurisdictions where our
          hosting providers maintain infrastructure. We take steps to ensure an adequate level of
          protection consistent with applicable data-protection laws in those regions.
        </p>
      </section>

      <section>
        <h2>Children&apos;s Privacy</h2>
        <p>
          The Service is not directed to children under 16, and we do not knowingly collect personal
          information from children. If we discover that a child under 16 has provided personal data,
          we will delete it promptly.
        </p>
      </section>

      <section>
        <h2>Updates to This Policy</h2>
        <p>
          We may update this Privacy Policy to reflect new features, legal requirements, or security
          practices. When we make material changes, we will update the “Last updated” date and, when
          appropriate, notify you through the Service or by email.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          Questions or requests about privacy? Reach us at{" "}
          <a href="mailto:privacy@alignmentid.com">privacy@alignmentid.com</a>. You can also review
          additional project details on the{" "}
          <Link href="https://github.com/alignmentid/gray">Alignment Gray repository</Link>.
        </p>
      </section>
    </main>
  );
}
