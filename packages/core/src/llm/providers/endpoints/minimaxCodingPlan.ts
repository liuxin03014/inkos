import type { InkosEndpoint } from "../types.js";

export const MINIMAX_CODING_PLAN: InkosEndpoint = {
  id: "minimaxCodingPlan",
  label: "MiniMax Coding Plan",
  api: "anthropic-messages",
  baseUrl: "https://api.minimaxi.com/anthropic",
  checkModel: "MiniMax-M2.7",
  temperatureRange: [0, 2],
  defaultTemperature: 0.9,
  writingTemperature: 0.9,
  models: [
    { id: "MiniMax-M2.7", displayName: "MiniMax M2.7", maxOutput: 131072, contextWindowTokens: 204800, abilities: { functionCall: true }, enabled: true, releasedAt: "2026-03-18" },
    { id: "MiniMax-M2.7-highspeed", displayName: "MiniMax M2.7 Highspeed", maxOutput: 131072, contextWindowTokens: 204800, abilities: { functionCall: true }, releasedAt: "2026-03-18" },
    { id: "MiniMax-M2.5", displayName: "MiniMax M2.5", maxOutput: 131072, contextWindowTokens: 204800, abilities: { functionCall: true }, enabled: true, releasedAt: "2026-02-12" },
    { id: "MiniMax-M2.5-highspeed", displayName: "MiniMax M2.5 Highspeed", maxOutput: 131072, contextWindowTokens: 204800, abilities: { functionCall: true }, releasedAt: "2026-02-12" },
    { id: "MiniMax-M2.1", displayName: "MiniMax M2.1", maxOutput: 131072, contextWindowTokens: 204800, abilities: { functionCall: true }, releasedAt: "2025-12-23" },
    { id: "MiniMax-M2", displayName: "MiniMax M2", maxOutput: 131072, contextWindowTokens: 204800, abilities: { functionCall: true }, releasedAt: "2025-12-23" },
  ],
};
