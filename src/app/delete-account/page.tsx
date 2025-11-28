"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { user, loading, deleteUserAccount } = useUser();
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      const redirect = encodeURIComponent("/delete-account");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, router, user]);

  const handleDelete = useCallback(async () => {
    if (!user || status === "deleting") {
      return;
    }

    if (confirmationEmail !== user.email) {
      setError("Email does not match.");
      return;
    }

    setStatus("deleting");
    setError(null);
    try {
      await deleteUserAccount();
      router.replace("/");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account.";
      setError(message);
      setStatus("error");
    }
  }, [deleteUserAccount, router, status, user, confirmationEmail]);

  const renderBody = () => {
    if (loading || !user) {
      return (
        <div className="delete-account__card">
          <LoaderCircle className="delete-account__spinner" size={20} />
          <p>Verifying your session...</p>
        </div>
      );
    }

    const description =
      status === "deleting"
        ? "Deleting your workspace data..."
        : "You re-authenticated successfully. This action cannot be undone.";

    const isMatch = confirmationEmail === user.email;

    return (
      <div className="delete-account__card">
        <h1>Delete Account</h1>
        <p className="delete-account__description">
          {description} To confirm, please type your email <strong>{user.email}</strong> below.
        </p>

        <input
          type="email"
          className="delete-account__input"
          placeholder={user.email}
          value={confirmationEmail}
          onChange={(e) => {
            setConfirmationEmail(e.target.value);
            if (error) setError(null);
          }}
          disabled={status === "deleting"}
        />

        {error ? <p className="delete-account__error">{error}</p> : null}

        <div className="delete-account__actions">
          <button
            type="button"
            className="delete-account__cancel"
            onClick={() => router.back()}
            disabled={status === "deleting"}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-account__button"
            disabled={status === "deleting" || !isMatch}
            onClick={handleDelete}
          >
            {status === "deleting" ? "Deleting..." : status === "error" ? "Retry delete" : "Delete account"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="delete-account">
      {renderBody()}
      <style jsx>{`
        .delete-account {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #020202;
          color: #f5f5f5;
          padding: 24px;
        }
        .delete-account__card {
          background: rgba(12, 12, 12, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          padding: 32px;
          max-width: 420px;
          width: 100%;
          text-align: left;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .delete-account__card h1 {
          margin: 0;
          font-size: 1.25rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .delete-account__description {
          margin: 0;
          line-height: 1.6;
          color: rgba(245, 245, 245, 0.85);
        }
        .delete-account__input {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 12px 16px;
            color: #fff;
            font-size: 1rem;
            width: 100%;
            outline: none;
            transition: border-color 0.2s;
        }
        .delete-account__input:focus {
            border-color: rgba(255, 255, 255, 0.3);
        }
        .delete-account__error {
          margin: 0;
          color: #ff9a9a;
          font-size: 0.9rem;
        }
        .delete-account__actions {
            display: flex;
            gap: 12px;
            margin-top: 8px;
        }
        .delete-account__button {
          flex: 1;
          border: none;
          border-radius: 999px;
          padding: 12px 16px;
          background: rgba(255, 71, 87, 0.2);
          color: #fff;
          font-size: 0.85rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 600;
        }
        .delete-account__button:hover:not(:disabled) {
          background: rgba(255, 71, 87, 0.35);
        }
        .delete-account__button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: rgba(255, 255, 255, 0.05);
        }
        .delete-account__cancel {
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.6);
            padding: 12px 16px;
            font-size: 0.85rem;
            cursor: pointer;
            transition: color 0.2s;
        }
        .delete-account__cancel:hover {
            color: #fff;
        }
        .delete-account__spinner {
          animation: delete-spin 1s linear infinite;
        }
        @keyframes delete-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
