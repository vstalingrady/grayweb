import LoginForm from "@/components/LoginForm";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <LoginForm />
      </div>
    </div>
  );
}
