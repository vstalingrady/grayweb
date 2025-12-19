import Link from "next/link";

export const metadata = {
  title: "Policies & Legal",
  description: "Legal policies for Gray, including terms of service, privacy, and refunds.",
  alternates: {
    canonical: "/policies",
  },
};

const policies = [
  {
    title: "Terms of Service",
    description: "Your agreement with Alignment when you use the Gray workspace.",
    href: "/policies/tos",
  },
  {
    title: "Privacy Policy",
    description: "How we collect, process, and safeguard account and workspace data.",
    href: "/policies/privacy",
  },
  {
    title: "Refund Policy",
    description: "Eligibility, timeframes, and the steps to request a subscription refund.",
    href: "/policies/refund",
  },
];

export default function PoliciesIndexPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <section className="legal-hero">
          <h1>Policies &amp; Legal</h1>
          <p>
            One place for the agreements that govern your use of the Gray workspace. Each entry links to a living
            document that we update whenever our product or compliance posture changes.
          </p>
        </section>

        <section>
          <ul className="policy-list">
            {policies.map((policy) => (
              <li key={policy.href}>
                <Link href={policy.href} className="policy-card">
                  <div>
                    <h2>{policy.title}</h2>
                    <p>{policy.description}</p>
                  </div>
                  <span aria-hidden="true">Read &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="legal-note">
          <p>
            Need something else? Email{" "}
            <a className="legal-contact" href="mailto:legal@alignment.id">
              legal@alignment.id
            </a>{" "}
            and we&apos;ll help you find the right document.
          </p>
        </section>
      </div>
    </main>
  );
}
