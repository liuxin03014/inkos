/**
 * inkos 自维护的 provider 定义。每个 provider 一个 .ts 文件，
 * 里面一个 InkosEndpoint 对象（provider 元数据 + models 数组）。
 *
 * 数据冷启动自 lobe-chat/packages/model-bank，之后由 inkos 自管。
 * 新模型发布 / 参数调整时手动加 card，不做持续 sync。
 */

export type ApiProtocol =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages";

export interface InkosModel {
  /** API 请求体里实际用的 model id（可能带斜线如 'deepseek/deepseek-v3'） */
  readonly id: string;
  /** UI 展示名。不填则用 id */
  readonly displayName?: string;
  /** 模型输出上限 tokens */
  readonly maxOutput: number;
  /** 上下文窗口总 tokens */
  readonly contextWindowTokens: number;
  /** 能力标签 */
  readonly abilities?: {
    readonly reasoning?: boolean;
    readonly vision?: boolean;
    readonly functionCall?: boolean;
    readonly search?: boolean;
    readonly structuredOutput?: boolean;
  };
  /** 默认 true。false 表示 lobe 标记此模型不可用 */
  readonly enabled?: boolean;
  /** CodingPlan 专用：API 调用时用这个代替 id 作为 model 字段 */
  readonly deploymentName?: string;
  /** 发布日期 ISO 字符串，可选（用于 UI 的"新模型"徽章） */
  readonly releasedAt?: string;
}

export interface InkosEndpoint {
  readonly id: string;
  readonly label: string;

  readonly api: ApiProtocol;
  readonly baseUrl: string;
  /** /models 接口的 baseUrl 跟主 baseUrl path 不同时（如百炼 dashscope） */
  readonly modelsBaseUrl?: string;

  /** apikey 两步验证时发 chat hello 用的模型 id */
  readonly checkModel?: string;

  readonly temperatureRange?: readonly [number, number];
  readonly defaultTemperature?: number;
  readonly writingTemperature?: number;
  readonly temperatureHint?: string;

  readonly models: readonly InkosModel[];
}
