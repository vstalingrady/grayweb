"use client";

import React from "react";

type IntegrationItem = {
  name: string;
  detail?: string;
};

type IntegrationGroup = {
  title: string;
  description: string;
  items: IntegrationItem[];
};

const integrationGroups: IntegrationGroup[] = [
  {
    title: "Chat Providers",
    description: "Message Gray from the chats you already use.",
    items: [
      { name: "WhatsApp", detail: "QR pairing via Baileys" },
      { name: "Telegram", detail: "Bot API via grammY" },
      { name: "Discord", detail: "Servers, channels & DMs" },
      { name: "Slack", detail: "Workspace apps via Bolt" },
      { name: "Google Chat", detail: "Chat API app" },
      { name: "Mattermost", detail: "Bot API + WebSocket" },
      { name: "Signal", detail: "Privacy-first via signal-cli" },
      { name: "iMessage", detail: "macOS imsg bridge" },
      { name: "BlueBubbles", detail: "iMessage server" },
      { name: "Microsoft Teams", detail: "Enterprise support" },
      { name: "LINE", detail: "Messaging API" },
      { name: "Nextcloud Talk", detail: "Self-hosted" },
      { name: "Matrix", detail: "Matrix protocol" },
      { name: "Nostr", detail: "NIP-04 DMs" },
      { name: "Tlon", detail: "Urbit messenger" },
      { name: "Twitch", detail: "Chat via IRC" },
      { name: "Zalo", detail: "Zalo Bot API" },
      { name: "Zalo Personal", detail: "QR login" },
      { name: "WebChat", detail: "Browser UI" },
    ],
  },
  {
    title: "AI Models",
    description: "Bring your own keys, mix providers, or go local.",
    items: [
      { name: "Anthropic", detail: "Claude family" },
      { name: "OpenAI", detail: "GPT-4/5 + o1" },
      { name: "Google", detail: "Gemini Pro/Flash" },
      { name: "xAI", detail: "Grok 3/4" },
      { name: "OpenRouter", detail: "Unified gateway" },
      { name: "Mistral", detail: "Large + Codestral" },
      { name: "DeepSeek", detail: "V3 + R1" },
      { name: "GLM", detail: "ChatGLM" },
      { name: "Qwen", detail: "Qwen models" },
      { name: "Moonshot", detail: "Kimi" },
      { name: "Perplexity", detail: "Search-augmented" },
      { name: "Hugging Face", detail: "Open models" },
      { name: "Local", detail: "Ollama / LM Studio" },
    ],
  },
  {
    title: "Productivity",
    description: "Notes, tasks, docs, and code workflows.",
    items: [
      { name: "Google Calendar", detail: "Scheduling + reminders" },
      { name: "Gmail", detail: "Search, draft, send" },
      { name: "Google Drive", detail: "Docs & files" },
      { name: "Apple Notes", detail: "Native notes" },
      { name: "Apple Reminders", detail: "Task management" },
      { name: "Things 3", detail: "GTD" },
      { name: "Notion", detail: "Pages + databases" },
      { name: "Obsidian", detail: "Vault automation" },
      { name: "Bear", detail: "Markdown notes" },
      { name: "Trello", detail: "Boards & cards" },
      { name: "GitHub", detail: "Issues + PRs" },
    ],
  },
  {
    title: "Music & Audio",
    description: "Control playback and identify tracks.",
    items: [
      { name: "Spotify", detail: "Search/queue/play" },
      { name: "Sonos", detail: "Multi-room control" },
      { name: "Shazam", detail: "Song recognition" },
    ],
  },
  {
    title: "Smart Home",
    description: "Voice-first control for your devices.",
    items: [
      { name: "Philips Hue", detail: "Scenes + lighting" },
      { name: "8Sleep", detail: "Sleep tuning" },
      { name: "Home Assistant", detail: "Self-hosted hub" },
    ],
  },
  {
    title: "Tools & Automation",
    description: "System control and scheduled workflows.",
    items: [
      { name: "Browser", detail: "Chrome/Chromium control" },
      { name: "Canvas", detail: "Visual workspace" },
      { name: "Voice", detail: "Wake + talk mode" },
      { name: "Webhooks", detail: "External triggers" },
      { name: "Cron", detail: "Scheduled tasks" },
      { name: "Gmail Pub/Sub", detail: "Inbox automations" },
      { name: "1Password", detail: "Secure credentials" },
      { name: "Weather", detail: "Forecasts" },
    ],
  },
  {
    title: "Media & Creative",
    description: "Generate, capture, and remix media.",
    items: [
      { name: "Image Gen", detail: "AI image creation" },
      { name: "GIF Search", detail: "Find the perfect GIF" },
      { name: "Peekaboo", detail: "Screen capture" },
      { name: "Camera", detail: "Photo/video capture" },
    ],
  },
  {
    title: "Social",
    description: "Publish, reply, and keep the loop tight.",
    items: [
      { name: "Twitter/X", detail: "Tweet + search" },
      { name: "Email", detail: "Read + send" },
    ],
  },
  {
    title: "Platforms",
    description: "Run the gateway anywhere, sync across devices.",
    items: [
      { name: "macOS", detail: "Menu bar app" },
      { name: "iOS", detail: "Canvas + camera" },
      { name: "Android", detail: "Canvas + screen" },
      { name: "Windows", detail: "WSL2 recommended" },
      { name: "Linux", detail: "Native support" },
      { name: "Web", detail: "Browser surfaces" },
    ],
  },
  {
    title: "Community Showcase",
    description: "Real-world builds shipped by the community.",
    items: [
      { name: "Tesco Autopilot", detail: "Automated grocery ordering" },
      { name: "Bambu Control", detail: "3D printer management" },
      { name: "Oura Ring", detail: "Health insights" },
      { name: "Food Ordering", detail: "Browser automation" },
    ],
  },
];

export default function IntegrationsSection() {
  return (
    <section className="integrations-section" aria-labelledby="integrations-heading">
      <div className="section-shell">
        <div className="integrations-header">
          <span className="integrations-eyebrow">Integrations</span>
          <h2 id="integrations-heading" className="integrations-title">
            50+ ways to wire Gray into your life.
          </h2>
          <p className="integrations-subtitle">
            Pull in the tools you already use, keep context light, and let Gray handle the busywork.
          </p>
        </div>

        <div className="integrations-grid">
          {integrationGroups.map((group) => (
            <article key={group.title} className="integrations-card">
              <header className="integrations-card__header">
                <h3 className="integrations-card__title">{group.title}</h3>
                <p className="integrations-card__desc">{group.description}</p>
              </header>
              <ul className="integrations-chip-grid" role="list">
                {group.items.map((item) => (
                  <li key={`${group.title}-${item.name}`} className="integrations-chip">
                    <span className="integrations-chip__name">{item.name}</span>
                    {item.detail ? (
                      <span className="integrations-chip__detail">{item.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
