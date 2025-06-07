import { ModelConfig, AIProvider } from '@/types';

// 支持的所有AI模型配置
export const AVAILABLE_MODELS: ModelConfig[] = [
  // DeepSeek 模型
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3 0324',
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    maxTokens: 4096,
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.0000014, // 1.4美元/1M tokens
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1 0528',
    provider: 'deepseek',
    modelId: 'deepseek-reasoner',
    maxTokens: 4096,
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.000055, // 55美元/1M tokens
  },

  // 阿里云通义千问模型
  {
    id: 'qwen-turbo',
    name: '通义千问 Turbo',
    provider: 'aliyun',
    modelId: 'qwen-turbo',
    maxTokens: 1500,
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.0000008, // 0.8美元/1M tokens
  },
  {
    id: 'qwen-plus',
    name: '通义千问 Plus',
    provider: 'aliyun',
    modelId: 'qwen-plus',
    maxTokens: 2000,
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.000004, // 4美元/1M tokens
  },
  {
    id: 'qwen-max',
    name: '通义千问 Max',
    provider: 'aliyun',
    modelId: 'qwen-max',
    maxTokens: 2000,
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.00002, // 20美元/1M tokens
  },
  {
    id: 'qwen2-57b-instruct',
    name: '通义千问2-57B',
    provider: 'aliyun',
    modelId: 'qwen2-57b-a14b-instruct',
    maxTokens: 2000,
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.000001,
  },

  // 火山引擎豆包模型
  {
    id: 'doubao-pro-32k',
    name: '豆包 Pro 32K',
    provider: 'volcengine',
    modelId: 'ep-20250424184643-vjbdz',
    maxTokens: 4096, // 修正为实际限制
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.0000005, // 估计价格
  },
  {
    id: 'doubao-pro-32k-241215',
    name: '豆包 1.5 pro 32k',
    provider: 'volcengine',
    modelId: 'ep-20250424184104-trxs8',
    maxTokens: 4096, // 修正为实际限制
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.0000005, // 估计价格
  },
  {
    id: 'doubao-pro-256k',
    name: '豆包 Pro 256K',
    provider: 'volcengine',
    modelId: 'doubao-pro-256k-241115',
    maxTokens: 4096, // 修正为安全值
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.000001, // 估计价格
  },
  {
    id: 'doubao-vision-pro',
    name: '豆包 Vision Pro',
    provider: 'volcengine',
    modelId: 'doubao-1.5-vision-pro-250328',
    maxTokens: 4096, // 修正为安全值
    temperature: 0.7,
    supportVision: true,
    costPerToken: 0.000002, // 估计价格
  },

  // Kimi (Moonshot) 模型
  {
    id: 'moonshot-v1-8k',
    name: 'Kimi V1 8K',
    provider: 'kimi',
    modelId: 'moonshot-v1-8k',
    maxTokens: 2048, // 保守设置，避免超过上下文限制
    temperature: 0.3,
    supportVision: false,
    costPerToken: 0.000012, // 12美元/1M tokens
  },
  {
    id: 'moonshot-v1-32k',
    name: 'Kimi V1 32K',
    provider: 'kimi',
    modelId: 'moonshot-v1-32k',
    maxTokens: 8192, // 保守设置，为输入留出更多空间
    temperature: 0.3,
    supportVision: false,
    costPerToken: 0.000024, // 24美元/1M tokens
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Kimi V1 128K',
    provider: 'kimi',
    modelId: 'moonshot-v1-128k',
    maxTokens: 16384, // 保守设置，为长上下文留出空间
    temperature: 0.3,
    supportVision: false,
    costPerToken: 0.00006, // 60美元/1M tokens
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'claude',
    modelId: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.7,
    supportVision: false,
    costPerToken: 0.000003, // Placeholder cost, please verify from 302.AI pricing
  },
];

// 根据提供商获取模型
export const getModelsByProvider = (provider: string) => {
  return AVAILABLE_MODELS.filter(model => model.provider === provider);
};

// 根据ID获取模型
export const getModelById = (id: string) => {
  return AVAILABLE_MODELS.find(model => model.id === id);
};

// 获取支持视觉的模型
export const getVisionModels = () => {
  return AVAILABLE_MODELS.filter(model => model.supportVision);
};

// 提供商信息
export const PROVIDERS: Record<AIProvider, { id: AIProvider; name: string; apiUrl: string; icon: string; color: string; supportStream?: boolean }> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com',
    icon: '🐟',
    color: '#1E40AF',
    supportStream: true,  
  },
  aliyun: {
    id: 'aliyun',
    name: '阿里云百练',
    apiUrl: 'https://dashscope.aliyuncs.com/api/v1',
    icon: '☁️',
    color: '#FF6600',
    supportStream: true,
  },
  volcengine: {
    id: 'volcengine',
    name: '火山引擎',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    icon: '🌋',
    color: '#1890FF',
    supportStream: true,
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    apiUrl: 'https://api.moonshot.cn',
    icon: '🌙',
    color: '#6366F1',
    supportStream: true,
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    apiUrl: 'https://api.302ai.cn/v1',
    icon: '✨',
    color: '#6A0DAD',
    supportStream: true,
  },
}; 