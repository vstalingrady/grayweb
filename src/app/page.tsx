import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.landing}>
      <section className={styles.hero}>
        <p className={styles.tag}>gray_hackathon</p>
        <h1>
          Alignment intelligence for <span>builders and dreamers</span>
        </h1>
        <p className={styles.subtitle}>
          Prototype your next idea with a minimalist noir toolkit. Bring your
          data, plug in Supabase, and ship a polished experience in hours—not
          days.
        </p>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/login">
            Sign in
          </Link>
          <Link className={styles.secondary} href="/signup">
            Create account
          </Link>
        </div>
      </section>

      <section className={styles.preview}>
        <div className={styles.previewGlow} />
        <div className={styles.previewCard}>
          <h2>Live telemetry</h2>
          <p>
            Monitor onboarding, retention, and system health with curated charts
            optimized for noir themes.
          </p>
          <ul>
            <li>Adaptive Supabase queries</li>
            <li>FastAPI integration ready</li>
            <li>Secure OAuth flows baked in</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
