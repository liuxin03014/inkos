import type { InkosEndpoint } from "../types.js";

export const STEPFUN: InkosEndpoint = {
  id: "stepfun",
  label: "阶跃星辰",
  api: "openai-completions",
  baseUrl: "https://api.stepfun.com/v1",
  checkModel: "step-1-8k",
  temperatureRange: [0, 1],
  defaultTemperature: 0.7,
  writingTemperature: 1,
  models: [
    { id: "step-3.5-flash", displayName: "Step 3.5 Flash", maxOutput: 4096, contextWindowTokens: 256000, abilities: { reasoning: true, functionCall: true, search: true }, enabled: true },
    { id: "step-3", displayName: "Step 3", maxOutput: 4096, contextWindowTokens: 64000, abilities: { reasoning: true, vision: true }, enabled: true },
    { id: "step-r1-v-mini", displayName: "Step R1 V Mini", maxOutput: 4096, contextWindowTokens: 100000, abilities: { reasoning: true, vision: true } },
    { id: "step-1-8k", displayName: "Step 1 8K", maxOutput: 4096, contextWindowTokens: 8000, abilities: { functionCall: true, search: true } },
    { id: "step-1-32k", displayName: "Step 1 32K", maxOutput: 4096, contextWindowTokens: 32000, abilities: { functionCall: true, search: true } },
    { id: "step-1-256k", displayName: "Step 1 256K", maxOutput: 4096, contextWindowTokens: 256000, abilities: { functionCall: true, search: true } },
    { id: "step-2-mini", displayName: "Step 2 Mini", maxOutput: 4096, contextWindowTokens: 8000, abilities: { functionCall: true, search: true }, releasedAt: "2025-01-14" },
    { id: "step-2-16k", displayName: "Step 2 16K", maxOutput: 4096, contextWindowTokens: 16000, abilities: { functionCall: true, search: true } },
    { id: "step-2-16k-exp", displayName: "Step 2 16K Exp", maxOutput: 4096, contextWindowTokens: 16000, abilities: { functionCall: true, search: true }, releasedAt: "2025-01-15" },
    { id: "step-1v-8k", displayName: "Step 1V 8K", maxOutput: 4096, contextWindowTokens: 8000, abilities: { vision: true, functionCall: true, search: true } },
    { id: "step-1v-32k", displayName: "Step 1V 32K", maxOutput: 4096, contextWindowTokens: 32000, abilities: { vision: true, functionCall: true, search: true } },
    { id: "step-1o-vision-32k", displayName: "Step 1o Vision 32K", maxOutput: 4096, contextWindowTokens: 32000, abilities: { vision: true }, releasedAt: "2025-01-22" },
    { id: "step-1o-turbo-vision", displayName: "Step 1o Turbo Vision", maxOutput: 4096, contextWindowTokens: 32000, abilities: { vision: true }, releasedAt: "2025-02-14" },
  ],
};
