export const metadata = {
  title: "Refund Policy",
};

const LAST_UPDATED = "November 2025";

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

export default function RefundPolicyPage() {
  return (
    <main className="legal-page">
      <article className="legal-shell legal-article">
        <div className="legal-article__content">
          <section className="legal-hero">
            <p className="legal-meta">Last updated {LAST_UPDATED}</p>
            <h1>Refund Policy</h1>
            <p>
              Alignment aims to make every Depth or paid workspace plan valuable. If something does not work for you,
              the following policy explains when you can request a refund and how the review process works.
            </p>
          </section>
          <section>
            <h2>Eligibility</h2>
            <BulletList
              items={[
                "Refunds apply only to paid subscriptions purchased directly from alignment.id. Purchases made through third-party marketplaces must follow that provider’s rules.",
                "Only the most recent billing cycle can be refunded. Historic invoices (older than 30 days) are not eligible.",
                "We require proof of purchase (the invoice ID or the email used at checkout).",
                "Abuse of the Service, chargeback activity, or violations of the Terms of Service void refund eligibility.",
              ]}
            />
          </section>

          <section>
            <h2>Timeframes</h2>
            <BulletList
              items={[
                "Monthly plans: request within 7 calendar days of the charge and with no more than reasonable use (for example, less than 200 AI messages).",
                "Annual plans: request within 30 calendar days of the charge; we will pro-rate usage beyond the first month.",
                "Add-ons such as workspace credit packs or custom integrations are non-refundable once provisioned.",
              ]}
            />
          </section>

          <section>
            <h2>How to Request a Refund</h2>
            <BulletList
              items={[
                "Email billing@alignmentid.com from the address on file (or submit through the Settings → Billing form in the app).",
                "Include your invoice ID, purchase date, and a short explanation of what went wrong so we can make the product better.",
                "We respond within 3 business days. Approved refunds are issued to the original payment method; banks may take 5–10 additional days to post the credit.",
              ]}
            />
          </section>

          <section>
            <h2>Partial Credits &amp; Downgrades</h2>
            <p>
              If you downgrade mid-cycle we convert the unused portion of your fee into workspace credit
              that automatically applies to the next invoice. Credits are not redeemable for cash unless
              required by law.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Have a billing question? Email <a href="mailto:billing@alignmentid.com">billing@alignmentid.com</a> and we
              will work through it together.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
