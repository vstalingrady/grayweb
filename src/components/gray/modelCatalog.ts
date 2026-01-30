export type CatalogModel = {
  id: string;
  label: string;
  cost?: string;
  tierRequired?: "pathfinder" | "voyager" | "pioneer";
};

export type ModelGroup = {
  id: string;
  label: string;
  iconPath: string;
  models: CatalogModel[];
};

export const GRAY_BRAND = {
  label: "Gray",
  iconPath: "/grayai.png",
} as const;

export const PIONEER_GROUPS: ModelGroup[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    iconPath: "/logos/claude-color.svg",
    models: [
      { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", cost: "$$", tierRequired: "pathfinder" },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", cost: "$$$", tierRequired: "voyager" },
      { id: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5", cost: "$$$$", tierRequired: "pioneer" },
    ],
  },
  {
    id: "google",
    label: "Google",
    iconPath: "/logos/gemini-color.svg",
    models: [
      { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", cost: "$$$", tierRequired: "voyager" },
      { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", cost: "$$", tierRequired: "pathfinder" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    iconPath: "/logos/whiteopenai.svg",
    models: [
      { id: "openai/gpt-5.2-chat", label: "GPT 5.2", cost: "$$$", tierRequired: "voyager" },
      { id: "openai/gpt-5.2-pro", label: "GPT 5.2 Pro", cost: "$$$$$", tierRequired: "pioneer" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    iconPath: "/grayai.png",
    models: [{ id: "openrouter/auto", label: "Auto", cost: "$$", tierRequired: "voyager" }],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    iconPath: "/logos/deepseek-color.svg",
    models: [
      { id: "deepseek/deepseek-v3.2", label: "Deepseek V3.2", cost: "$", tierRequired: "pathfinder" },
      { id: "deepseek/deepseek-v3.2-speciale", label: "Deepseek V3.2 Speciale", cost: "$", tierRequired: "pathfinder" },
    ],
  },
  {
    id: "x-ai",
    label: "xAI",
    iconPath: "/logos/whitegrok.svg",
    models: [{ id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", cost: "$", tierRequired: "pathfinder" }],
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    iconPath: "/logos/whitekimi.svg",
    models: [
      { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5", cost: "$$$", tierRequired: "pathfinder" },
      { id: "moonshotai/kimi-k2-0905", label: "Kimi K2 (Fast)", cost: "$$$", tierRequired: "voyager" },
    ],
  },
  {
    id: "minimax",
    label: "MiniMax",
    iconPath: "/logos/minimax-color.svg",
    models: [
      { id: "minimax/minimax-m2.1", label: "MiniMax M2.1", cost: "$$", tierRequired: "pathfinder" },
      { id: "minimax/minimax-m2-her", label: "MiniMax M2 - her", cost: "$$", tierRequired: "pathfinder" },
    ],
  },
  {
    id: "xiaomi",
    label: "Xiaomi",
    iconPath: "/logos/xiaomi.svg",
    models: [{ id: "xiaomi/mimo-v2-flash:free", label: "MiMo V2 Flash", cost: "$", tierRequired: "pathfinder" }],
  },
  {
    id: "z-ai",
    label: "Z.ai",
    iconPath: "/logos/zaiwhite.svg",
    models: [
      { id: "z-ai/glm-4.7", label: "GLM 4.7", cost: "$$", tierRequired: "pathfinder" },
      { id: "z-ai/glm-4.7-flash", label: "GLM 4.7 Flash", cost: "$", tierRequired: "pathfinder" },
    ],
  },
];

export const ALL_PIONEER_MODEL_IDS: string[] = PIONEER_GROUPS.flatMap((group) => group.models.map((model) => model.id));

export const PIONEER_ONLY_MODEL_IDS: string[] = PIONEER_GROUPS.flatMap((group) =>
  group.models.filter((model) => model.tierRequired === "pioneer").map((model) => model.id)
);

export const RECOMMENDED_PIONEER_MODEL_IDS: string[] = PIONEER_GROUPS.flatMap((group) =>
  group.models.filter((model) => (model.tierRequired ?? "voyager") === "voyager").map((model) => model.id)
);
