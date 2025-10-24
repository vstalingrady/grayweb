import LoginForm from "@/components/LoginForm";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <section className={styles.hero}>
          <p className={styles.pill}>gray_hackathon · auth module</p>
          <h1>
            Minimalist noir access <span>powered by Supabase</span>
          </h1>
          <p className={styles.subtitle}>
            Sign in securely with Google or Discord, or fall back to email and
            password. Styled with Plus Jakarta Sans for clean typography and IBM
            Plex Mono for precise detail.
          </p>
          <ul className={styles.features}>
            <li>
              <strong>Instant OAuth:</strong> authenticated in one tap with Google
              or Discord.
            </li>
            <li>
              <strong>Production ready:</strong> built-in feedback, validation,
              and loading states.
            </li>
            <li>
              <strong>Noir aesthetic:</strong> monochrome palette with subtle
              highlights.
            </li>
          </ul>
        </section>

        <section className={styles.formSection}>
          <LoginForm />
        </section>
      </div>
    </div>
  );
}
