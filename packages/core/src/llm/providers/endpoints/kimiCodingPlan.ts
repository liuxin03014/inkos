import type { InkosEndpoint } from "../types.js";

export const KIMI_CODING_PLAN: InkosEndpoint = {
  id: "kimiCodingPlan",
  label: "Kimi Coding Plan",
  api: "anthropic-messages",
  baseUrl: "https://api.moonshot.cn/anthropic",
  checkModel: "kimi-k2.5",
  temperatureRange: [0, 1],
  defaultTemperature: 1,
  writingTemperature: 1,
  temperatureHint: "kimi-k2.5 推荐 temperature=1.0",
  models: [
    { id: "kimi-k2.5", displayName: "Kimi K2.5", maxOutput: 32768, contextWindowTokens: 262144, abilities: { reasoning: true, vision: true, functionCall: true }, enabled: true, releasedAt: "2026-01-27", deploymentName: "k2p5" },
    { id: "kimi-k2-thinking", displayName: "Kimi K2 Thinking", maxOutput: 65536, contextWindowTokens: 262144, abilities: { reasoning: true, functionCall: true }, releasedAt: "2025-11-06" },
  ],
};
