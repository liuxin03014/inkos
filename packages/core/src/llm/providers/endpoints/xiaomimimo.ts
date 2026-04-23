import type { InkosEndpoint } from "../types.js";

export const XIAOMI_MIMO: InkosEndpoint = {
  id: "xiaomimimo",
  label: "小米 MiMo",
  api: "openai-completions",
  baseUrl: "https://api-ai.xiaomi.com/v1",
  temperatureRange: [0, 2],
  defaultTemperature: 0.7,
  writingTemperature: 1,
  models: [
    { id: "mimo-v2-pro", displayName: "MiMo-V2 Pro", maxOutput: 131072, contextWindowTokens: 1000000, abilities: { reasoning: true, functionCall: true, search: true, structuredOutput: true }, enabled: true, releasedAt: "2026-03-18" },
    { id: "mimo-v2-omni", displayName: "MiMo-V2 Omni", maxOutput: 131072, contextWindowTokens: 262144, abilities: { reasoning: true, vision: true, functionCall: true, search: true, structuredOutput: true }, enabled: true, releasedAt: "2026-03-18" },
    { id: "mimo-v2-flash", displayName: "MiMo-V2 Flash", maxOutput: 65536, contextWindowTokens: 262144, abilities: { reasoning: true, functionCall: true, search: true, structuredOutput: true }, enabled: true, releasedAt: "2026-03-03" },
  ],
};
