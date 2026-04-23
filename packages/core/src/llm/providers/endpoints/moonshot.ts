import type { InkosEndpoint } from "../types.js";

export const MOONSHOT: InkosEndpoint = {
  id: "moonshot",
  label: "Moonshot (Kimi)",
  api: "openai-completions",
  baseUrl: "https://api.moonshot.cn/v1",
  checkModel: "moonshot-v1-8k",
  temperatureRange: [0, 1],
  defaultTemperature: 0.3,
  writingTemperature: 1,
  temperatureHint: "kimi-k2.5 推荐 temperature=1.0",
  models: [
    { id: "kimi-k2.5", displayName: "Kimi K2.5", maxOutput: 32768, contextWindowTokens: 262144, abilities: { reasoning: true, vision: true, functionCall: true, structuredOutput: true }, enabled: true, releasedAt: "2026-01-27" },
    { id: "kimi-k2-thinking", displayName: "Kimi K2 Thinking", maxOutput: 65536, contextWindowTokens: 262144, abilities: { reasoning: true, functionCall: true, structuredOutput: true }, releasedAt: "2025-11-06" },
    { id: "kimi-k2-thinking-turbo", displayName: "Kimi K2 Thinking Turbo", maxOutput: 65536, contextWindowTokens: 262144, abilities: { reasoning: true, functionCall: true, structuredOutput: true }, releasedAt: "2025-11-06" },
    { id: "kimi-k2-0905-preview", displayName: "Kimi K2 0905 Preview", maxOutput: 65536, contextWindowTokens: 262144, abilities: { functionCall: true, structuredOutput: true }, releasedAt: "2025-09-05" },
    { id: "kimi-k2-0711-preview", displayName: "Kimi K2 0711 Preview", maxOutput: 4096, contextWindowTokens: 131072, abilities: { functionCall: true }, releasedAt: "2025-07-11" },
    { id: "kimi-k2-turbo-preview", displayName: "Kimi K2 Turbo Preview", maxOutput: 4096, contextWindowTokens: 262144, abilities: { functionCall: true }, enabled: true, releasedAt: "2025-09-05" },
    { id: "moonshot-v1-8k", displayName: "Moonshot V1 8K", maxOutput: 4096, contextWindowTokens: 8192, abilities: { functionCall: true } },
    { id: "moonshot-v1-32k", displayName: "Moonshot V1 32K", maxOutput: 4096, contextWindowTokens: 32768, abilities: { functionCall: true } },
    { id: "moonshot-v1-128k", displayName: "Moonshot V1 128K", maxOutput: 4096, contextWindowTokens: 131072, abilities: { functionCall: true } },
    { id: "moonshot-v1-8k-vision-preview", displayName: "Moonshot V1 8K Vision Preview", maxOutput: 4096, contextWindowTokens: 8192, abilities: { vision: true, functionCall: true }, releasedAt: "2025-01-14" },
    { id: "moonshot-v1-32k-vision-preview", displayName: "Moonshot V1 32K Vision Preview", maxOutput: 4096, contextWindowTokens: 32768, abilities: { vision: true, functionCall: true }, releasedAt: "2025-01-14" },
    { id: "moonshot-v1-128k-vision-preview", displayName: "Moonshot V1 128K Vision Preview", maxOutput: 4096, contextWindowTokens: 131072, abilities: { vision: true, functionCall: true }, releasedAt: "2025-01-14" },
  ],
};
