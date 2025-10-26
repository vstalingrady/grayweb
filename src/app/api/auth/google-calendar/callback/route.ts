import { NextRequest, NextResponse } from "next/server";

const successHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <title>Google Calendar Connected</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0f0f0f;
        color: #f5f5f5;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
      }
      .card {
        background: #181818;
        border-radius: 16px;
        padding: 32px;
        max-width: 420px;
        text-align: center;
        box-shadow: 0 25px 45px rgba(0, 0, 0, 0.45);
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
      }
      p {
        color: rgba(255, 255, 255, 0.65);
        line-height: 1.4;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Google Calendar connected</h1>
      <p>You can close this window and return to Gray.</p>
    </div>
    <script>
      setTimeout(() => {
        if (window.opener) {
          window.opener.postMessage({ type: "google-calendar-connected" }, "*");
        }
        window.close();
      }, 1500);
    </script>
  </body>
</html>`;

const buildErrorHtml = (message: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <title>Google Calendar Error</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #1b0000;
        color: #fff;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
      }
      .card {
        background: #2a0505;
        border-radius: 16px;
        padding: 32px;
        max-width: 480px;
        text-align: center;
        box-shadow: 0 25px 45px rgba(0, 0, 0, 0.45);
      }
      h1 {
        font-size: 1.4rem;
        margin-bottom: 0.75rem;
      }
      p {
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Unable to finish Google Calendar setup</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;

const htmlResponse = (html: string, status = 200) =>
  new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });

const buildBackendCallbackUrl = (request: NextRequest) => {
  const base = new URL(request.url);
  base.pathname = "/api/backend/google-calendar/oauth/callback";
  base.search = "";
  return base.toString();
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return htmlResponse(buildErrorHtml("Missing authorization data from Google."), 400);
  }

  const redirectUri = `${url.origin}${url.pathname}`;

  try {
    const backendResponse = await fetch(buildBackendCallbackUrl(request), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    });

    if (!backendResponse.ok) {
      let detail = "Unexpected response from the backend service.";
      try {
        const payload = await backendResponse.json();
        detail = payload?.detail ?? detail;
      } catch {
        // plain text fallback
      }
      return htmlResponse(buildErrorHtml(detail), backendResponse.status);
    }

    return htmlResponse(successHtml);
  } catch (error) {
    console.error("Failed to finalize Google Calendar OAuth:", error);
    return htmlResponse(buildErrorHtml("We could not reach the backend. Please try again."), 502);
  }
}
