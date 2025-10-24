import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./page.module.css";

type TodoRow = Record<string, unknown>;

async function loadTodos(): Promise<{
  rows: TodoRow[];
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .limit(5);

    if (error) {
      return { rows: [], error: error.message };
    }

    return { rows: data ?? [] };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Supabase error.";
    return { rows: [], error: message };
  }
}

export default async function Home() {
  const { rows, error } = await loadTodos();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Next.js + Supabase starter</h1>
          <p>
            Environment variables from your `.env` file are wired up to both the
            FastAPI backend and this Next.js app. Supabase queries run on the
            server so you can securely integrate data that is exposed via the
            anon key.
          </p>
        </div>
        <div className={styles.supabasePanel}>
          <h2>Sample Supabase query</h2>
          <p>
            This page attempts to read from a `todos` table using the anon key.
            Update the query or create the table in your Supabase project to see
            data below.
          </p>
          {error ? (
            <p className={styles.error}>
              Could not fetch data: <span>{error}</span>
            </p>
          ) : (
            <ul className={styles.list}>
              {rows.length === 0 ? (
                <li>No rows returned.</li>
              ) : (
                rows.map((row, index) => (
                  <li key={`todo-${index}`}>
                    <pre>{JSON.stringify(row, null, 2)}</pre>
                  </li>
                ))
              )}
            </ul>
          )}
          <p className={styles.docs}>
            Need help?{" "}
            <Link
              href="https://supabase.com/docs/guides/getting-started/quickstarts/nextjs"
              target="_blank"
            >
              Supabase Next.js guide
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
