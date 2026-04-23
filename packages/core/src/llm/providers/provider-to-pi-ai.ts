import type { InkosEndpoint } from "./types.js";

/**
 * 从 InkosEndpoint 推出 pi-ai Model 的 `provider` 字段。
 *
 * pi-ai 内部会再根据 baseUrl 做 per-vendor 嗅探（api.z.ai / api.x.ai /
 * openrouter.ai / deepseek.com / api.anthropic.com 等），所以大多数情况下
 * 这里返回 "openai" 或 "anthropic" 即可。
 *
 * 少数 pi-ai 嗅探不到的需要显式覆盖（如智谱的 open.bigmodel.cn 不含 z.ai 域名，
 * 但要走 zai 兼容层）。
 */
export function resolvePiAiProvider(endpoint: InkosEndpoint): string {
  const explicitMap: Record<string, string> = {
    zhipu: "zai",
    openrouter: "openrouter",
    githubCopilot: "githubCopilot",
  };
  if (endpoint.id in explicitMap) return explicitMap[endpoint.id]!;

  if (endpoint.api === "anthropic-messages") return "anthropic";

  return "openai";
}
