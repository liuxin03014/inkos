import type { InkosEndpoint } from "../types.js";

export const INTERNLM: InkosEndpoint = {
  id: "internlm",
  label: "书生浦语 (InternLM)",
  api: "openai-completions",
  baseUrl: "https://chat.intern-ai.org.cn/api/v1",
  checkModel: "internlm2.5-latest",
  temperatureRange: [0, 2],
  defaultTemperature: 0.8,
  writingTemperature: 1,
  models: [
    { id: "intern-latest", displayName: "Intern", maxOutput: 4096, contextWindowTokens: 262144, abilities: { reasoning: true, vision: true, functionCall: true }, releasedAt: "2026-02-04" },
    { id: "intern-s1-pro", displayName: "Intern-S1-Pro", maxOutput: 4096, contextWindowTokens: 262144, abilities: { reasoning: true, vision: true, functionCall: true }, enabled: true, releasedAt: "2026-02-04" },
    { id: "intern-s1", displayName: "Intern-S1", maxOutput: 4096, contextWindowTokens: 32768, abilities: { reasoning: true, vision: true, functionCall: true }, enabled: true, releasedAt: "2025-07-26" },
    { id: "intern-s1-mini", displayName: "Intern-S1-Mini", maxOutput: 4096, contextWindowTokens: 32768, abilities: { reasoning: true, vision: true, functionCall: true }, enabled: true, releasedAt: "2025-08-20" },
    { id: "internvl3.5-latest", displayName: "InternVL3.5", maxOutput: 4096, contextWindowTokens: 32768, abilities: { vision: true }, releasedAt: "2025-08-28" },
    { id: "internvl3.5-241b-a28b", displayName: "InternVL3.5-241B-A28B", maxOutput: 4096, contextWindowTokens: 32768, abilities: { vision: true }, enabled: true, releasedAt: "2025-08-28" },
  ],
};
