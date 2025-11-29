import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Deleted",
  description: "Your account has been successfully deleted.",
};

export default function ConfirmDeletePage() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        margin: 0,
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        background: "#020202",
        color: "#f5f5f5",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 600, margin: "0 0 1rem 0" }}>Account Deleted</h1>
        <p style={{ fontSize: "1.1rem", marginTop: "0.75rem", color: "#6b7280" }}>
          Your account and all associated data have been permanently deleted.
        </p>
        <p style={{ fontSize: "0.9rem", marginTop: "1rem", color: "#4a4a4a" }}>
          You are always welcome to create a new account if you change your mind.
        </p>
      </div>
    </main>
  );
}