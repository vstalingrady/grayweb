import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Alignment about Gray. Email hello@alignment.id or join our Discord to start a conversation.",
  alternates: {
    canonical: "/contact",
  },
};

const ContactPage = () => (
  <main className="page-shell">
    <section className="page-hero">
      <h1>Contact</h1>
      <p>
        Email hello@alignment.id or join our Discord to start a conversation. We&apos;re always open to
        collaborators who defend focus, sovereignty, and compassion.
      </p>
    </section>
  </main>
);

export default ContactPage;
