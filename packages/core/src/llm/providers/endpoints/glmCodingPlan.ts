import type { InkosEndpoint } from "../types.js";

export const GLM_CODING_PLAN: InkosEndpoint = {
  id: "glmCodingPlan",
  label: "GLM Coding Plan",
  api: "anthropic-messages",
  baseUrl: "https://api.z.ai/api/anthropic",
  checkModel: "glm-5.1",
  temperatureRange: [0, 1],
  defaultTemperature: 0.95,
  writingTemperature: 0.95,
  models: [
    { id: "GLM-5.1", displayName: "GLM-5.1", maxOutput: 131072, contextWindowTokens: 204800, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2026-03-27" },
    { id: "GLM-5", displayName: "GLM-5", maxOutput: 131072, contextWindowTokens: 200000, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2026-02-12" },
    { id: "GLM-5-Turbo", displayName: "GLM-5-Turbo", maxOutput: 131072, contextWindowTokens: 200000, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2026-02-12" },
    { id: "GLM-4.7", displayName: "GLM-4.7", maxOutput: 131072, contextWindowTokens: 200000, abilities: { reasoning: true, functionCall: true }, enabled: true, releasedAt: "2025-12-01" },
    { id: "GLM-4.6", displayName: "GLM-4.6", maxOutput: 65536, contextWindowTokens: 202752, abilities: { functionCall: true }, releasedAt: "2025-12-01" },
    { id: "GLM-4.5", displayName: "GLM-4.5", maxOutput: 65536, contextWindowTokens: 202752, abilities: { functionCall: true }, releasedAt: "2025-12-01" },
    { id: "GLM-4.5-Air", displayName: "GLM-4.5-Air", maxOutput: 65536, contextWindowTokens: 202752, abilities: { functionCall: true }, releasedAt: "2025-12-01" },
  ],
};
