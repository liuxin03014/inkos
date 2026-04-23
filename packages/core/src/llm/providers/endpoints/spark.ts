import type { InkosEndpoint } from "../types.js";

export const SPARK: InkosEndpoint = {
  id: "spark",
  label: "讯飞星火",
  api: "openai-completions",
  baseUrl: "https://spark-api-open.xf-yun.com/v1",
  checkModel: "general",
  temperatureRange: [0, 1],
  defaultTemperature: 0.5,
  writingTemperature: 0.95,
  models: [
    { id: "spark-x", displayName: "Spark X2", maxOutput: 131072, contextWindowTokens: 131072, abilities: { reasoning: true, functionCall: true, search: true }, enabled: true },
    { id: "x1", displayName: "Spark X1.5", maxOutput: 65535, contextWindowTokens: 65535, abilities: { reasoning: true, functionCall: true, search: true } },
    { id: "lite", displayName: "Spark Lite", maxOutput: 4096, contextWindowTokens: 12288, enabled: true },
    { id: "generalv3", displayName: "Spark Pro", maxOutput: 8192, contextWindowTokens: 16384, abilities: { search: true } },
    { id: "pro-128k", displayName: "Spark Pro 128K", maxOutput: 131072, contextWindowTokens: 131072 },
    { id: "generalv3.5", displayName: "Spark Max", maxOutput: 8192, contextWindowTokens: 16384, abilities: { functionCall: true, search: true } },
    { id: "max-32k", displayName: "Spark Max 32K", maxOutput: 32768, contextWindowTokens: 65536, abilities: { functionCall: true, search: true } },
    { id: "4.0Ultra", displayName: "Spark 4.0 Ultra", maxOutput: 32768, contextWindowTokens: 65536, abilities: { reasoning: true, functionCall: true, search: true } },
  ],
};
