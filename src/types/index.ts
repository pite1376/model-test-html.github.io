// AI模型提供商
export type AIProvider = 'deepseek' | 'aliyun' | 'volcengine' | 'kimi' | 'claude';

// 模型配置
export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  supportVision?: boolean;
  costPerToken?: number;
}

// API密钥配置
export interface ApiKeyConfig {
  provider: AIProvider;
  apiKey: string;
  isValid?: boolean;
}

// 消息类型
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: string[]; // base64格式的图片
}

// 模型响应
export interface ModelResponse {
  modelId: string;
  content: string;
  loading: boolean;
  error?: string;
  responseTime?: number;
  tokens?: number;
  cost?: number;
  timestamp: Date;
}

// 对话会话
export interface ChatSession {
  id: string;
  title?: string;
  systemPrompt: string;
  selectedModels: string[];
  messages: Message[];
  responses: Record<string, Record<string, ModelResponse>>; // modelId -> messageId -> response
  createdAt: Date;
  updatedAt: Date;
  model: string;
  provider: AIProvider;
  tokenCount: number;
  cost: number;
  temperature: number;
  maxTokens: number;
}

// 应用状态
export interface AppState {
  // API配置
  apiKeys: Record<AIProvider, string>;
  
  // 模型配置
  availableModels: ModelConfig[];
  selectedModels: string[];
  
  // 当前会话
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  
  // UI状态
  isLoading: boolean;
  systemPrompt: string;
  
  // 统计信息
  totalTokens: number;
  totalCost: number;
}

// API请求参数
export interface ChatRequest {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean; // 添加流式请求选项
}

// API响应
export interface ChatResponse {
  content: string;
  tokens: number;
  cost?: number;
  responseTime: number;
}

// 流式响应块
export interface StreamChunk {
  content: string;
  finished: boolean;
  tokens?: number;
  cost?: number;
}

// 流式响应回调
export type StreamCallback = (chunk: StreamChunk) => void; 