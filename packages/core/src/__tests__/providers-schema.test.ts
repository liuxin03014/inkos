import { describe, it, expect } from "vitest";
import { getAllEndpoints, getEndpoint } from "../llm/providers/index.js";

describe("providers structural integrity", () => {
  it("每个 provider 必填字段都存在", () => {
    const gatewayProviders = new Set(["custom", "higress", "newapi"]);
    for (const p of getAllEndpoints()) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.api).toMatch(/^(openai-completions|openai-responses|anthropic-messages)$/);
      // gateway/anchor provider 允许 baseUrl 为空（由用户填）
      if (gatewayProviders.has(p.id)) {
        expect(typeof p.baseUrl).toBe("string");
      } else {
        expect(p.baseUrl, `provider=${p.id}`).toBeTruthy();
      }
    }
  });

  it("每个 model card 必填字段都存在且 contextWindowTokens >= maxOutput", () => {
    for (const p of getAllEndpoints()) {
      for (const m of p.models) {
        expect(m.id, `provider=${p.id}`).toBeTruthy();
        expect(m.maxOutput, `provider=${p.id} model=${m.id}`).toBeGreaterThan(0);
        expect(m.contextWindowTokens, `provider=${p.id} model=${m.id}`).toBeGreaterThanOrEqual(m.maxOutput);
      }
    }
  });

  it("每个 provider 的 id 唯一", () => {
    const ids = getAllEndpoints().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个 provider 里 models 的 id 唯一", () => {
    for (const p of getAllEndpoints()) {
      const ids = p.models.map((m) => m.id);
      expect(new Set(ids).size, `provider=${p.id} 有重复 model id`).toBe(ids.length);
    }
  });

  it("A 组至少有 6 个核心 provider", () => {
    const ids = getAllEndpoints().map((p) => p.id);
    expect(ids).toContain("anthropic");
    expect(ids).toContain("openai");
    expect(ids).toContain("google");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("qwen");
    expect(ids).toContain("minimax");
  });

  it("B1：中国原厂批次 1 全部收录（10 个）", () => {
    const ids = getAllEndpoints().map((p) => p.id);
    for (const id of [
      "moonshot", "zhipu", "siliconcloud", "ppio", "bailian",
      "volcengine", "hunyuan", "baichuan", "stepfun", "wenxin",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("B1：bailian 保留 anthropic-messages api（例外，不按 lobe 迁移）", () => {
    expect(getEndpoint("bailian")?.api).toBe("anthropic-messages");
    expect(getEndpoint("bailian")?.baseUrl).toContain("/anthropic");
  });

  it("B1：minimax 保留 anthropic-messages api（例外）", () => {
    expect(getEndpoint("minimax")?.api).toBe("anthropic-messages");
    expect(getEndpoint("minimax")?.baseUrl).toContain("/anthropic");
  });

  it("B2：中国原厂批次 2 全部收录（6 个）", () => {
    const ids = getAllEndpoints().map((p) => p.id);
    for (const id of ["spark", "sensenova", "tencentcloud", "xiaomimimo", "longcat", "internlm"]) {
      expect(ids).toContain(id);
    }
  });

  it("B3：中国原厂批次 3 全部收录（7 个）", () => {
    const ids = getAllEndpoints().map((p) => p.id);
    for (const id of ["modelscope", "giteeai", "qiniu", "higress", "infiniai", "zeroone", "ai360"]) {
      expect(ids).toContain(id);
    }
  });

  it("B3：higress baseUrl 为空（gateway 占位）", () => {
    expect(getEndpoint("higress")?.baseUrl).toBe("");
  });

  it("B4：海外/本地/自定义/聚合/GH 全部收录（7 个）", () => {
    const ids = getAllEndpoints().map((p) => p.id);
    for (const id of ["ollama", "openrouter", "custom", "mistral", "xai", "newapi", "githubCopilot"]) {
      expect(ids).toContain(id);
    }
  });

  it("B4：custom / newapi / higress baseUrl 为空", () => {
    expect(getEndpoint("custom")?.baseUrl).toBe("");
    expect(getEndpoint("newapi")?.baseUrl).toBe("");
    expect(getEndpoint("higress")?.baseUrl).toBe("");
  });

  it("B4：总 provider 数 = 36（不含 CodingPlan）", () => {
    const nonCoding = getAllEndpoints().filter((p) => !p.id.endsWith("CodingPlan"));
    expect(nonCoding.length).toBe(36);
  });

  it("B6：CodingPlan 6 个 provider 全部收录", () => {
    const ids = getAllEndpoints().map((p) => p.id);
    for (const id of [
      "kimiCodingPlan", "minimaxCodingPlan", "bailianCodingPlan",
      "glmCodingPlan", "volcengineCodingPlan", "opencodeCodingPlan",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("B6：总 provider 数 = 42 (36 base + 6 CodingPlan)", () => {
    expect(getAllEndpoints().length).toBe(42);
  });

  it("B6：CodingPlan provider 都走 anthropic-messages", () => {
    for (const id of [
      "kimiCodingPlan", "minimaxCodingPlan", "bailianCodingPlan",
      "glmCodingPlan", "volcengineCodingPlan", "opencodeCodingPlan",
    ]) {
      expect(getEndpoint(id)?.api).toBe("anthropic-messages");
    }
  });
});
