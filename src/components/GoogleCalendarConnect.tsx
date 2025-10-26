"use client";

interface GoogleCalendarConnectProps {
  onConnect: (authUrl: string) => void;
}

export function GoogleCalendarConnect({ onConnect }: GoogleCalendarConnectProps) {
  const handleConnect = async () => {
    try {
      // Call your backend to get the Google Calendar auth URL
      const response = await fetch("/api/users/1/google-calendar/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Failed to get Google Calendar auth URL");
        return;
      }

      const data = await response.json();
      const authUrl = data.authorization_url;

      // Open the Google Calendar authorization URL in a new window
      window.open(authUrl, "_blank");
    } catch (error) {
      console.error("Error connecting to Google Calendar:", error);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto" }}>
      <h2>Connect Google Calendar</h2>
      <p>
        Connect your Google Calendar to sync your events and schedules across platforms.
      </p>
      <button
        type="button"
        onClick={handleConnect}
        style={{
          backgroundColor: "#4285f4",
          color: "white",
          border: "none",
          padding: "12px 24px",
          borderRadius: "8px",
          fontSize: "16px",
          cursor: "pointer",
          width: "100%",
          fontWeight: "bold",
        }}
      >
        Connect Google Calendar
      </button>
    </div>
  );
}