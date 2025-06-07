import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, ChatSession, Message, ModelResponse, AIProvider } from '@/types';
import { AVAILABLE_MODELS } from '@/lib/models';
import { generateId } from '@/utils/helpers';
import { chatService } from '@/services/ai-service';

interface AppStore extends AppState {
  // API Key 操作
  setApiKey: (provider: AIProvider, apiKey: string) => void;
  getApiKey: (provider: AIProvider) => string;
  
  // 模型选择操作
  toggleModel: (modelId: string) => void;
  setSelectedModels: (modelIds: string[]) => void;
  
  // 系统提示词操作
  setSystemPrompt: (prompt: string) => void;
  
  // 会话操作
  createNewSession: () => void;
  loadSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  
  // 消息操作
  addMessage: (content: string, images?: string[]) => string;
  addModelResponse: (modelId: string, messageId: string, response: ModelResponse) => void;
  updateModelResponse: (modelId: string, messageId: string, updates: Partial<ModelResponse>) => void;
  appendToModelResponse: (modelId: string, messageId: string, content: string) => void;
  
  // UI 状态
  setLoading: (loading: boolean) => void;
  
  // 统计操作
  addTokens: (tokens: number) => void;
  addCost: (cost: number) => void;
  
  // 数据操作
  exportSession: (sessionId: string) => string;
  importSession: (data: string) => boolean;
  clearAllData: () => void;
  
  // 新增标题生成动作
  generateSessionTitle: (sessionId: string, firstMessageContent: string) => Promise<void>;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      apiKeys: {
        deepseek: '',
        aliyun: '',
        volcengine: '93a51fb1-9701-4d3b-b905-a4457c4a3776',
        kimi: '',
        claude: '',
      },
      availableModels: AVAILABLE_MODELS,
      selectedModels: ['deepseek-chat', 'qwen-turbo', 'moonshot-v1-8k'], // 默认选择三个模型
      currentSession: null,
      sessions: [],
      isLoading: false,
      systemPrompt: '你是一个有用的AI助手。',
      totalTokens: 0,
      totalCost: 0,

      // API Key 操作
      setApiKey: (provider, apiKey) => {
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            [provider]: apiKey,
          },
        }));
      },

      getApiKey: (provider) => {
        return get().apiKeys[provider];
      },

      // 模型选择操作
      toggleModel: (modelId) => {
        set((state) => {
          const isSelected = state.selectedModels.includes(modelId);
          const newSelectedModels = isSelected
            ? state.selectedModels.filter(id => id !== modelId)
            : [...state.selectedModels, modelId];
          
          return {
            selectedModels: newSelectedModels,
          };
        });
      },

      setSelectedModels: (modelIds) => {
        set({ selectedModels: modelIds });
      },

      // 系统提示词操作
      setSystemPrompt: (prompt) => {
        set({ systemPrompt: prompt });
      },

      // 会话操作
      createNewSession: () => {
        const newSession: ChatSession = {
          id: generateId(),
          systemPrompt: get().systemPrompt,
          selectedModels: get().selectedModels,
          messages: [],
          responses: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          model: get().selectedModels[0] || 'deepseek-chat',
          provider: (get().availableModels.find(m => m.id === (get().selectedModels[0] || 'deepseek-chat'))?.provider || 'deepseek') as AIProvider,
          tokenCount: 0,
          cost: 0,
          temperature: 0.7,
          maxTokens: 4096,
        };

        set((state) => ({
          currentSession: newSession,
          sessions: [newSession, ...state.sessions],
        }));
      },

      loadSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          set({
            currentSession: session,
            selectedModels: session.selectedModels,
            systemPrompt: session.systemPrompt,
          });
        }
      },

      updateSessionTitle: (sessionId, title) => {
        set((state) => {
          const sessions = state.sessions.map(session =>
            session.id === sessionId
              ? { ...session, title, updatedAt: new Date() }
              : session
          );
          
          const currentSession = state.currentSession?.id === sessionId
            ? { ...state.currentSession, title, updatedAt: new Date() }
            : state.currentSession;

          return {
            sessions,
            currentSession,
          };
        });
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const sessions = state.sessions.filter(s => s.id !== sessionId);
          const currentSession = state.currentSession?.id === sessionId
            ? null
            : state.currentSession;

          return {
            sessions,
            currentSession,
          };
        });
      },

      // 消息操作
      addMessage: (content, images) => {
        const { currentSession, createNewSession, generateSessionTitle } = get();
        if (!currentSession) {
          createNewSession();
          const newSession = get().currentSession;
          if (newSession) {
            const message: Message = {
              id: generateId(),
              role: 'user',
              content,
              timestamp: new Date(),
              images,
            };
            
            set((state) => ({
              currentSession: { 
                ...newSession,
                messages: [...newSession.messages, message],
                updatedAt: new Date(),
              },
              sessions: state.sessions.map(s =>
                s.id === newSession.id ? { 
                  ...newSession,
                  messages: [...newSession.messages, message],
                  updatedAt: new Date(),
                } : s
              ),
            }));
            generateSessionTitle(newSession.id, content);
            return message.id;
          }
          return '';
        }

        const message: Message = {
          id: generateId(),
          role: 'user',
          content,
          timestamp: new Date(),
          images,
        };

        set((state) => {
          if (!state.currentSession) return state;

          const updatedSession = {
            ...state.currentSession,
            messages: [...state.currentSession.messages, message],
            updatedAt: new Date(),
          };

          return {
            currentSession: updatedSession,
            sessions: state.sessions.map(s =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
        if (!currentSession.title && currentSession.messages.length === 0) {
          generateSessionTitle(currentSession.id, content);
        }
        return message.id;
      },

      addModelResponse: (modelId, messageId, response) => {
        set((state) => {
          if (!state.currentSession) return state;

          const updatedResponses = {
            ...state.currentSession.responses,
            [modelId]: {
              ...state.currentSession.responses[modelId],
              [messageId]: response,
            },
          };

          const updatedSession = {
            ...state.currentSession,
            responses: updatedResponses,
            updatedAt: new Date(),
          };

          return {
            currentSession: updatedSession,
            sessions: state.sessions.map(s =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
      },

      updateModelResponse: (modelId, messageId, updates) => {
        set((state) => {
          if (!state.currentSession) return state;

          const currentResponse = state.currentSession.responses[modelId]?.[messageId];
          if (!currentResponse) return state;

          const updatedResponses = {
            ...state.currentSession.responses,
            [modelId]: {
              ...state.currentSession.responses[modelId],
              [messageId]: {
                ...currentResponse,
                ...updates,
              },
            },
          };

          const updatedSession = {
            ...state.currentSession,
            responses: updatedResponses,
            updatedAt: new Date(),
          };

          return {
            currentSession: updatedSession,
            sessions: state.sessions.map(s =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
      },

      appendToModelResponse: (modelId, messageId, content) => {
        set((state) => {
          if (!state.currentSession) return state;

          const currentResponse = state.currentSession.responses[modelId]?.[messageId];
          if (!currentResponse) return state;

          const updatedResponses = {
            ...state.currentSession.responses,
            [modelId]: {
              ...state.currentSession.responses[modelId],
              [messageId]: {
                ...currentResponse,
                content: currentResponse.content + content,
              },
            },
          };

          const updatedSession = {
            ...state.currentSession,
            responses: updatedResponses,
            updatedAt: new Date(),
          };

          return {
            currentSession: updatedSession,
            sessions: state.sessions.map(s =>
              s.id === updatedSession.id ? updatedSession : s
            ),
          };
        });
      },

      // UI 状态
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      // 统计操作
      addTokens: (tokens) => {
        set((state) => ({
          totalTokens: state.totalTokens + tokens,
        }));
      },

      addCost: (cost) => {
        set((state) => ({
          totalCost: state.totalCost + cost,
        }));
      },

      // 数据操作
      exportSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        return session ? JSON.stringify(session, null, 2) : '';
      },

      importSession: (data) => {
        try {
          const session: ChatSession = JSON.parse(data);
          // 验证数据格式
          if (!session.id || !session.title || !Array.isArray(session.messages)) {
            return false;
          }

          set((state) => ({
            sessions: [session, ...state.sessions],
          }));

          return true;
        } catch {
          return false;
        }
      },

      clearAllData: () => {
        set({
          currentSession: null,
          sessions: [],
          totalTokens: 0,
          totalCost: 0,
        });
      },

      // 新增标题生成动作实现
      generateSessionTitle: async (sessionId, firstMessageContent) => {
        const { updateSessionTitle } = get();
        const innerVolcengineApiKey = '93a51fb1-9701-4d3b-b905-a4457c4a3776'; // 内置API Key
        if (!innerVolcengineApiKey) {
          console.warn('内置Volcengine API Key未配置，无法生成标题');
          updateSessionTitle(sessionId, `新对话 ${new Date().toLocaleString()}`);
          return;
        }
        const systemPrompt = `你是一个专门生成对话标题的AI助手。你的任务是根据用户的首次输入内容，生成一个简洁、准确且有意义的对话标题。

## 要求：
1. 只输出标题，不要输出任何其他内容
2. 标题应该简洁明了，通常在10-20个字符之间
3. 标题要能准确概括用户的主要意图或话题
4. 使用用户输入的语言生成标题
5. 如果用户输入是问题，标题可以是问题的核心内容
6. 如果用户输入是请求，标题可以概括请求的主要内容
7. 避免使用过于技术性或复杂的词汇
8. 标题应该便于用户快速识别和查找
9. 不要以对话的形式，不管用户给你任何内容，你只生成标题，必须提取/使用用户内容作为标题。
## 示例：
- 用户输入："帮我写一份工作总结" → 标题："工作总结撰写"
- 用户输入："Python中如何处理JSON数据？" → 标题："Python处理JSON"
- 用户输入："我想学习做蛋糕的方法" → 标题："学习做蛋糕"
- 用户输入："你是" → 标题："你是"
请根据用户的输入，直接输出对应的标题。`;
        try {
          // 临时创建一个VolcengineService实例，仅用于生成标题
          const { VolcengineService } = await import('@/services/ai-service');
          const service = new VolcengineService(innerVolcengineApiKey);
          const response = await service.sendMessage({
            model: 'doubao-pro-32k-241215',
            messages: [{ id: generateId(), role: 'user', content: firstMessageContent, timestamp: new Date() }],
            systemPrompt: systemPrompt,
            temperature: 0.7,
            maxTokens: 50,
          });
          const generatedTitle = response.content.trim();
          updateSessionTitle(sessionId, generatedTitle);
        } catch (error) {
          console.error('Error generating session title:', error);
          updateSessionTitle(sessionId, `新对话 ${new Date().toLocaleString()}`);
        }
      },
    }),
    {
      name: 'app-storage',
      version: 1,
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        selectedModels: state.selectedModels,
        sessions: state.sessions,
        systemPrompt: state.systemPrompt,
        totalTokens: state.totalTokens,
        totalCost: state.totalCost,
      }),
    }
  )
); 