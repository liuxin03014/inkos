import type { InkosEndpoint } from "../types.js";

export const BAILIAN_CODING_PLAN: InkosEndpoint = {
  id: "bailianCodingPlan",
  label: "百炼 Coding Plan",
  api: "anthropic-messages",
  baseUrl: "https://dashscope.aliyuncs.com/apps/anthropic",
  checkModel: "qwen-max",
  temperatureRange: [0, 2],
  defaultTemperature: 0.7,
  writingTemperature: 1,
  models: [
    { id: "qwen3.5-plus", displayName: "Qwen3.5 Plus", maxOutput: 65536, contextWindowTokens: 1000000, abilities: { reasoning: true, vision: true, functionCall: true }, enabled: true, releasedAt: "2026-02-15" },
    { id: "qwen3-coder-plus", displayName: "Qwen3 Coder Plus", maxOutput: 65536, contextWindowTokens: 1000000, abilities: { functionCall: true }, releasedAt: "2025-09-23" },
    { id: "qwen3-max-2026-01-23", displayName: "Qwen3 Max", maxOutput: 65536, contextWindowTokens: 262144, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2026-01-23" },
    { id: "qwen3-coder-next", displayName: "Qwen3 Coder Next", maxOutput: 65536, contextWindowTokens: 262144, abilities: { functionCall: true }, releasedAt: "2026-02-15" },
    { id: "glm-5", displayName: "GLM-5", maxOutput: 131072, contextWindowTokens: 200000, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2026-02-12" },
    { id: "glm-4.7", displayName: "GLM-4.7", maxOutput: 131072, contextWindowTokens: 200000, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2025-12-01" },
    { id: "kimi-k2.5", displayName: "Kimi K2.5", maxOutput: 32768, contextWindowTokens: 262144, abilities: { reasoning: true, vision: true, functionCall: true }, enabled: true, releasedAt: "2026-01-27" },
    { id: "MiniMax-M2.5", displayName: "MiniMax-M2.5", maxOutput: 131072, contextWindowTokens: 204800, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2026-02-12" },
  ],
};
