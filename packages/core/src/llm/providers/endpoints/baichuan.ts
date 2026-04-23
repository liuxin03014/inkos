import type { InkosEndpoint } from "../types.js";

export const BAICHUAN: InkosEndpoint = {
  id: "baichuan",
  label: "百川智能",
  api: "openai-completions",
  baseUrl: "https://api.baichuan-ai.com/v1",
  checkModel: "Baichuan4",
  temperatureRange: [0, 1],
  defaultTemperature: 0.3,
  writingTemperature: 1,
  models: [
    { id: "Baichuan4", displayName: "Baichuan 4", maxOutput: 4096, contextWindowTokens: 32768, abilities: { functionCall: true, search: true }, enabled: true },
    { id: "Baichuan4-Turbo", displayName: "Baichuan 4 Turbo", maxOutput: 4096, contextWindowTokens: 32768, abilities: { functionCall: true, search: true }, enabled: true },
    { id: "Baichuan4-Air", displayName: "Baichuan 4 Air", maxOutput: 4096, contextWindowTokens: 32768, abilities: { functionCall: true, search: true }, enabled: true },
    { id: "Baichuan3-Turbo", displayName: "Baichuan 3 Turbo", maxOutput: 8192, contextWindowTokens: 32768, abilities: { functionCall: true, search: true } },
    { id: "Baichuan3-Turbo-128k", displayName: "Baichuan 3 Turbo 128k", maxOutput: 4096, contextWindowTokens: 128000 },
    { id: "Baichuan2-Turbo", displayName: "Baichuan 2 Turbo", maxOutput: 8192, contextWindowTokens: 32768 },
  ],
};
