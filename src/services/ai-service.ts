import axios, { AxiosInstance } from 'axios';
import { ChatRequest, ChatResponse, Message, AIProvider, StreamCallback } from '@/types';

// AI服务基类
export abstract class AIService {
  protected client: AxiosInstance;
  protected apiKey: string;
  protected baseURL: string;

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  abstract sendMessage(request: ChatRequest): Promise<ChatResponse>;
  abstract sendMessageStream(request: ChatRequest, onChunk: StreamCallback): Promise<ChatResponse>;
  abstract formatMessages(messages: Message[], systemPrompt?: string): any[];
  abstract calculateCost(tokens: number, model: string): number;
}

// DeepSeek AI服务
export class DeepSeekService extends AIService {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.deepseek.com');
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  formatMessages(messages: Message[], systemPrompt?: string) {
    const formattedMessages = [];
    
    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    return formattedMessages.concat(
      messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))
    );
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.7,
        max_tokens: Math.min(request.maxTokens || 4096, 4096), // 确保不超过4096
        stream: false,
      };

      console.log('DeepSeek API Request:', JSON.stringify(requestBody, null, 2));

      const response = await this.client.post('/v1/chat/completions', requestBody);

      console.log('DeepSeek API Response:', response.data);

      const responseTime = Date.now() - startTime;
      const content = response.data.choices[0]?.message?.content || '';
      const tokens = response.data.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('DeepSeek API Error:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message ||
                          error.message || 
                          '请求失败';
      throw new Error(`DeepSeek API错误: ${errorMessage}`);
    }
  }

  async sendMessageStream(request: ChatRequest, onChunk: StreamCallback): Promise<ChatResponse> {
    const startTime = Date.now();
    console.log('🚀 DeepSeek 开始流式请求...');
    
    try {
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.7,
        max_tokens: Math.min(request.maxTokens || 4096, 4096),
        stream: true,
      };

      console.log('DeepSeek Stream API Request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek Stream Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ DeepSeek 流式响应开始...');

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取流响应');
      }

      let content = '';
      let tokens = 0;
      const decoder = new TextDecoder();
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('🏁 DeepSeek 流式结束');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              console.log('✅ DeepSeek 流式完成信号');
              onChunk({ content: '', finished: true, tokens });
              break;
            }

            if (data) {
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  chunkCount++;
                  content += delta;
                  console.log(`📝 DeepSeek 流式块 ${chunkCount}:`, JSON.stringify(delta));
                  // 立即调用回调函数
                  onChunk({ content: delta, finished: false });
                }
                if (parsed.usage?.total_tokens) {
                  tokens = parsed.usage.total_tokens;
                }
              } catch (e) {
                console.log('❌ DeepSeek Parse error for:', data);
              }
            }
          }
        }
      }

      // 确保发送完成信号
      onChunk({ content: '', finished: true, tokens });

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(tokens, request.model);

      console.log(`🎉 DeepSeek 流式完成，总共 ${chunkCount} 块，耗时 ${responseTime}ms`);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('❌ DeepSeek Stream API Error:', error);
      const errorMessage = error.message || '流式请求失败';
      throw new Error(`DeepSeek Stream API错误: ${errorMessage}`);
    }
  }

  calculateCost(tokens: number, model: string): number {
    // DeepSeek的价格（美元/1M tokens）
    const prices: Record<string, number> = {
      'deepseek-chat': 0.14,
      'deepseek-coder': 0.14,
      'deepseek-reasoner': 55,
    };
    
    const pricePerMillion = prices[model] || 0.14;
    return (tokens / 1000000) * pricePerMillion;
  }
}

// 阿里云百练服务 - 兼容模式 (OpenAI风格)
export class AliyunService extends AIService {
  constructor(apiKey: string) {
    super(apiKey, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
    this.client.defaults.headers['Content-Type'] = 'application/json';
    this.client.defaults.headers['Accept'] = 'application/json';
    // 兼容模式不需要 X-DashScope-SSE 头部
  }

  formatMessages(messages: Message[], systemPrompt?: string) {
    const formattedMessages = [];
    
    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    return formattedMessages.concat(
      messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))
    );
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      // 兼容模式 - OpenAI风格请求体
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.85,
        max_tokens: Math.min(request.maxTokens || 2000, 2000),
        top_p: 0.8,
        stream: false
      };

      console.log('Aliyun Compatible Mode API Request:', JSON.stringify(requestBody, null, 2));

      // 兼容模式端点
      const response = await this.client.post('/chat/completions', requestBody);

      console.log('Aliyun Compatible Mode API Response:', JSON.stringify(response.data, null, 2));

      const responseTime = Date.now() - startTime;
      
      // OpenAI风格响应解析
      const content = response.data.choices?.[0]?.message?.content || '';
      const usage = response.data.usage || {};
      const tokens = usage.total_tokens || 
                    (usage.prompt_tokens || 0) + (usage.completion_tokens || 0) || 
                    0;
      
      const cost = this.calculateCost(tokens, request.model);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('Aliyun Compatible Mode API Error:', error);
      console.error('完整错误响应:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        data: error.response?.data
      });
      
      let errorMessage = '请求失败';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        errorMessage = errorData.error?.message ||
                      errorData.message || 
                      errorData.code ||
                      `HTTP ${error.response.status}: ${JSON.stringify(errorData)}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(`阿里云API错误 (兼容模式): ${errorMessage}`);
    }
  }

  async sendMessageStream(request: ChatRequest, onChunk: StreamCallback): Promise<ChatResponse> {
    const startTime = Date.now();
    console.log('☁️ 阿里云 开始流式请求...');
    
    try {
      // 阿里云兼容模式支持真正的流式输出
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.85,
        max_tokens: Math.min(request.maxTokens || 2000, 2000),
        top_p: 0.8,
        stream: true
      };

      console.log('Aliyun Stream API Request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Aliyun Stream API Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取流响应');
      }

      let content = '';
      let tokens = 0;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onChunk({ content: '', finished: true, tokens });
              break;
            }

            if (data) {
              try {
                const parsed = JSON.parse(data);
                // 根据阿里云API返回格式解析
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  content += delta;
                  onChunk({ content: delta, finished: false });
                }
                if (parsed.usage?.total_tokens) {
                  tokens = parsed.usage.total_tokens;
                }
              } catch (e) {
                // 忽略解析错误
                console.log('Aliyun Parse error for:', data);
              }
            }
          }
        }
      }

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('Aliyun Stream API Error:', error);
      throw error; // 重新抛出原始错误
    }
  }

  calculateCost(tokens: number, model: string): number {
    // 阿里云的价格（美元/1M tokens）
    const prices: Record<string, number> = {
      'qwen-turbo': 0.8,
      'qwen-plus': 4,
      'qwen-max': 20,
      'qwen2-57b-a14b-instruct': 2,
    };
    
    const pricePerMillion = prices[model] || 1;
    return (tokens / 1000000) * pricePerMillion;
  }
}

// 火山引擎服务
export class VolcengineService extends AIService {
  constructor(apiKey: string) {
    super(apiKey, 'https://ark.cn-beijing.volces.com/api/v3');
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  formatMessages(messages: Message[], systemPrompt?: string): any[] {
    const formattedMessages: any[] = [];
    
    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    const messageList = messages.map(msg => {
      if (msg.images && msg.images.length > 0) {
        // 支持视觉模型
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...msg.images.map(image => ({
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${image}` },
            })),
          ],
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });

    return [...formattedMessages, ...messageList];
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.post('/chat/completions', {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.7,
        max_tokens: Math.min(request.maxTokens || 4096, 4096), // 火山引擎严格限制为4096
        stream: false,
      });

      const responseTime = Date.now() - startTime;
      const content = response.data.choices[0]?.message?.content || '';
      const tokens = response.data.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('Volcengine API Error:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message ||
                          error.message || 
                          '请求失败';
      throw new Error(`火山引擎API错误: ${errorMessage}`);
    }
  }

  async sendMessageStream(request: ChatRequest, onChunk: StreamCallback): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      // 火山引擎支持真正的流式输出
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.7,
        max_tokens: Math.min(request.maxTokens || 4096, 4096),
        stream: true,
      };

      console.log('Volcengine Stream API Request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Volcengine Stream API Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取流响应');
      }

      let content = '';
      let tokens = 0;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onChunk({ content: '', finished: true, tokens });
              break;
            }

            if (data) {
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  content += delta;
                  onChunk({ content: delta, finished: false });
                }
                if (parsed.usage?.total_tokens) {
                  tokens = parsed.usage.total_tokens;
                }
              } catch (e) {
                // 忽略解析错误
                console.log('Volcengine Parse error for:', data);
              }
            }
          }
        }
      }

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('Volcengine Stream API Error:', error);
      throw error; // 重新抛出原始错误
    }
  }

  calculateCost(tokens: number, model: string): number {
    // 火山引擎的估计价格（美元/1M tokens）
    const prices: Record<string, number> = {
      'ep-20250424184643-vjbdz': 0.5, // 豆包 Pro 32K
      'doubao-pro-256k-241115': 1,
      'doubao-1.5-vision-pro-250328': 2,
    };
    
    const pricePerMillion = prices[model] || 1;
    return (tokens / 1000000) * pricePerMillion;
  }
}

// Kimi (Moonshot) AI服务
export class KimiService extends AIService {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.moonshot.cn/v1');
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  formatMessages(messages: Message[], systemPrompt?: string) {
    const formattedMessages = [];
    
    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    return formattedMessages.concat(
      messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))
    );
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.3,
        max_tokens: Math.min(request.maxTokens || 2048, 128000), // Kimi 128k上下文
        stream: false,
      };

      console.log('Kimi API Request:', JSON.stringify(requestBody, null, 2));

      const response = await this.client.post('/chat/completions', requestBody);

      console.log('Kimi API Response:', response.data);

      const responseTime = Date.now() - startTime;
      const content = response.data.choices[0]?.message?.content || '';
      const tokens = response.data.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('Kimi API Error:', error);
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message ||
                          error.message || 
                          '请求失败';
      throw new Error(`Kimi API错误: ${errorMessage}`);
    }
  }

  async sendMessageStream(request: ChatRequest, onChunk: StreamCallback): Promise<ChatResponse> {
    const startTime = Date.now();
    console.log('🚀 Kimi 开始流式请求...');
    
    try {
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.3,
        max_tokens: Math.min(request.maxTokens || 2048, 128000),
        stream: true,
      };

      console.log('Kimi Stream API Request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Kimi Stream Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Kimi 流式响应开始...');

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取流响应');
      }

      let content = '';
      let tokens = 0;
      const decoder = new TextDecoder();
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('🏁 Kimi 流式结束');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              console.log('✅ Kimi 流式完成信号');
              onChunk({ content: '', finished: true, tokens });
              break;
            }

            if (data) {
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  chunkCount++;
                  content += delta;
                  console.log(`📝 Kimi 流式块 ${chunkCount}:`, JSON.stringify(delta));
                  // 立即调用回调函数
                  onChunk({ content: delta, finished: false });
                }
                if (parsed.usage?.total_tokens) {
                  tokens = parsed.usage.total_tokens;
                }
              } catch (e) {
                console.log('❌ Kimi Parse error for:', data);
              }
            }
          }
        }
      }

      // 确保发送完成信号
      onChunk({ content: '', finished: true, tokens });

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(tokens, request.model);

      console.log(`🎉 Kimi 流式完成，总共 ${chunkCount} 块，耗时 ${responseTime}ms`);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('❌ Kimi Stream API Error:', error);
      const errorMessage = error.message || '流式请求失败';
      throw new Error(`Kimi Stream API错误: ${errorMessage}`);
    }
  }

  calculateCost(tokens: number, model: string): number {
    // Kimi (Moonshot) 的价格（美元/1M tokens）
    const prices: Record<string, number> = {
      'moonshot-v1-8k': 12,    // 12美元/1M tokens
      'moonshot-v1-32k': 24,   // 24美元/1M tokens  
      'moonshot-v1-128k': 60,  // 60美元/1M tokens
    };
    
    const pricePerMillion = prices[model] || 12;
    return (tokens / 1000000) * pricePerMillion;
  }
}

// Claude AI服务 (302.AI API)
export class ClaudeService extends AIService {
  constructor(apiKey: string) {
    super(apiKey, 'https://api.302ai.cn/v1'); // 302.AI Claude API URL
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
    this.client.defaults.headers['Accept'] = 'application/json'; // Claude specific
  }

  formatMessages(messages: Message[], systemPrompt?: string) {
    const formattedMessages = [];

    if (systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    return formattedMessages.concat(
      messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))
    );
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.7,
        max_tokens: Math.min(request.maxTokens || 4096, 4096),
        stream: false,
      };

      console.log('Claude API Request:', JSON.stringify(requestBody, null, 2));

      const response = await this.client.post('/chat/completions', requestBody);

      console.log('Claude API Response:', response.data);

      const responseTime = Date.now() - startTime;
      const content = response.data.choices?.[0]?.message?.content || '';
      const tokens = response.data.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('Claude API Error:', error);
      const errorMessage = error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        '请求失败';
      throw new Error(`Claude API错误: ${errorMessage}`);
    }
  }

  async sendMessageStream(request: ChatRequest, onChunk: StreamCallback): Promise<ChatResponse> {
    const startTime = Date.now();
    console.log('🚀 Claude 开始流式请求...');

    try {
      const requestBody = {
        model: request.model,
        messages: this.formatMessages(request.messages, request.systemPrompt),
        temperature: request.temperature || 0.7,
        max_tokens: Math.min(request.maxTokens || 4096, 4096),
        stream: true,
      };

      console.log('Claude Stream API Request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Claude Stream Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Claude 流式响应开始...');

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取流响应');
      }

      let content = '';
      let tokens = 0;
      const decoder = new TextDecoder();
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('🏁 Claude 流式结束');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              console.log('✅ Claude 流式完成信号');
              onChunk({ content: '', finished: true, tokens });
              break;
            }

            if (data) {
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  chunkCount++;
                  content += delta;
                  console.log(`📝 Claude 流式块 ${chunkCount}:`, JSON.stringify(delta));
                  onChunk({ content: delta, finished: false });
                }
                if (parsed.usage?.total_tokens) {
                  tokens = parsed.usage.total_tokens;
                }
              } catch (e) {
                console.log('❌ Claude Parse error for:', data);
              }
            }
          }
        }
      }

      onChunk({ content: '', finished: true, tokens });

      const responseTime = Date.now() - startTime;
      const cost = this.calculateCost(tokens, request.model);

      console.log(`🎉 Claude 流式完成，总共 ${chunkCount} 块，耗时 ${responseTime}ms`);

      return {
        content,
        tokens,
        cost,
        responseTime,
      };
    } catch (error: any) {
      console.error('❌ Claude Stream API Error:', error);
      const errorMessage = error.message || '流式请求失败';
      throw new Error(`Claude Stream API错误: ${errorMessage}`);
    }
  }

  calculateCost(tokens: number, model: string): number {
    const prices: Record<string, number> = {
      // Claude 的价格（美元/1M tokens）
      'claude-sonnet-3-5-20240620': 3 / 1000000,   // Input 3/M, Output 15/M
      'claude-opus-20240229': 15 / 1000000,    // Input 15/M, Output 75/M
      'claude-sonnet-20240229': 3 / 1000000,   // Input 3/M, Output 15/M
      'claude-haiku-20240307': 0.25 / 1000000, // Input 0.25/M, Output 1.25/M
      'claude-3-sonnet-20240229': 3 / 1000000,
    };

    const pricePerMillion = prices[model] || 3 / 1000000;
    return tokens * pricePerMillion;
  }
}

// 服务工厂
export class AIServiceFactory {
  static createService(provider: AIProvider, apiKey: string): AIService {
    switch (provider) {
      case 'deepseek':
        return new DeepSeekService(apiKey);
      case 'aliyun':
        return new AliyunService(apiKey);
      case 'volcengine':
        return new VolcengineService(apiKey);
      case 'kimi':
        return new KimiService(apiKey);
      case 'claude':
        return new ClaudeService(apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}

// 聊天服务
export class ChatService {
  private services: Map<string, AIService> = new Map();

  setApiKey(provider: AIProvider, apiKey: string) {
    if (apiKey.trim()) {
      const service = AIServiceFactory.createService(provider, apiKey);
      this.services.set(provider, service);
    } else {
      this.services.delete(provider);
    }
  }

  async sendMessage(provider: AIProvider, request: ChatRequest): Promise<ChatResponse> {
    const service = this.services.get(provider);
    if (!service) {
      throw new Error(`请先配置 ${provider} 的API密钥`);
    }

    return await service.sendMessage(request);
  }

  async sendMessageStream(provider: AIProvider, request: ChatRequest, onChunk: StreamCallback): Promise<ChatResponse> {
    const service = this.services.get(provider);
    if (!service) {
      throw new Error(`请先配置 ${provider} 的API密钥`);
    }

    return await service.sendMessageStream(request, onChunk);
  }

  async sendMessageToAll(
    providers: AIProvider[],
    request: ChatRequest
  ): Promise<Record<string, ChatResponse | Error>> {
    const results: Record<string, ChatResponse | Error> = {};

    const promises = providers.map(async (provider) => {
      try {
        const response = await this.sendMessage(provider, request);
        results[provider] = response;
      } catch (error) {
        results[provider] = error as Error;
      }
    });

    await Promise.allSettled(promises);
    return results;
  }
}

// 全局聊天服务实例
export const chatService = new ChatService(); 