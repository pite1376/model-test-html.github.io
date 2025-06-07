import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store';
import { chatService } from '@/services/ai-service';
import { AVAILABLE_MODELS, PROVIDERS } from '@/lib/models';
import { validateApiKey } from '@/utils/helpers';
import { Send, Settings, MessageSquare, ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { AIProvider, ModelResponse } from '@/types';
import useLocalStorage from '@/utils/hooks';
import TypewriterEffect from './components/TypewriterEffect';
import { getDocument } from 'pdfjs-dist';
import mammoth from 'mammoth';

interface CollapsibleSectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  onToggle: () => void;
  isOpen: boolean;
  className?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  icon,
  onToggle,
  isOpen,
  className,
}) => {
  return (
    <div className={`border-b border-gray-200 ${className || ''}`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-100"
      >
        <h3 className="text-sm font-medium text-gray-700 flex items-center space-x-2">
          {icon && icon}
          <span>{title}</span>
        </h3>
        {isOpen ? (
          <ChevronDown size={16} className="text-gray-500" />
        ) : (
          <ChevronRight size={16} className="text-gray-500" />
        )}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};

function App() {
  const { 
    apiKeys, 
    setApiKey, 
    selectedModels, 
    toggleModel,
    systemPrompt,
    setSystemPrompt,
    currentSession,
    createNewSession,
    addMessage,
    addModelResponse,
    updateModelResponse,
    appendToModelResponse,
    isLoading,
    setLoading,
    sessions,
    loadSession
  } = useAppStore();

  const [inputMessage, setInputMessage] = useState('');
  const [showSettings, setShowSettings] = useLocalStorage('showSettings', true);
  const [showModels, setShowModels] = useLocalStorage('showModels', true);
  const [showSystemPrompt, setShowSystemPrompt] = useLocalStorage('showSystemPrompt', true);
  const [showHistory, setShowHistory] = useLocalStorage('showHistory', true);
  const [testingApi, setTestingApi] = useState<Record<string, boolean>>({});
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [parsedFileContent, setParsedFileContent] = useState<string>('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(() => {
    return localStorage.getItem('history_clear_dont_ask') === 'true';
  });
  const [modalDontAskAgain, setModalDontAskAgain] = useState(false);

  // 新增：判断火山引擎密钥是否填写
  const hasVolcengineKey = !!apiKeys['volcengine'];

  // 新增：判断各模型密钥是否填写
  const isProviderKeyFilled = (provider: AIProvider) => !!apiKeys[provider];

  // 初始化API服务
  useEffect(() => {
    Object.entries(apiKeys).forEach(([provider, apiKey]) => {
      if (apiKey) {
        chatService.setApiKey(provider as any, apiKey);
      }
    });
  }, [apiKeys]);

  // 测试API连接
  const testApiConnection = async (provider: AIProvider) => {
    setTestingApi(prev => ({ ...prev, [provider]: true }));
    
    try {
      const testMessage = {
        id: 'test',
        role: 'user' as const,
        content: 'Hello',
        timestamp: new Date(),
      };

      const response = await chatService.sendMessage(provider, {
        model: AVAILABLE_MODELS.find(m => m.provider === provider)?.modelId || '',
        messages: [testMessage],
        systemPrompt: '你是一个助手，请简短回复。',
        maxTokens: 50,
      });

      alert(`${PROVIDERS[provider].name} API 连接成功！\n响应: ${response.content.substring(0, 100)}...`);
    } catch (error) {
      alert(`${PROVIDERS[provider].name} API 连接失败:\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTestingApi(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !parsedFileContent) return;
    if (isLoading) return;
    if (!currentSession) {
      createNewSession();
    }
    // 只保存输入内容和文件名/图片base64
    const userMessageId = addMessage(inputMessage, uploadedImage ? [uploadedImage] : uploadedFile ? [uploadedFile.name] : undefined);
    // 实际发给大模型的内容
    let messageToSend = inputMessage;
    if (parsedFileContent) {
      messageToSend += '\n\n【上传文档内容】：\n' + parsedFileContent;
    }
    setInputMessage('');
    setParsedFileContent('');
    setUploadedFile(null);
    setUploadedImage(null);
    setLoading(true);

    // 获取选中的模型
    let activeModels = AVAILABLE_MODELS.filter(model => selectedModels.includes(model.id));
    // 新增：过滤掉未填写密钥的volcengine模型，并弹窗提示
    const needVolcengine = activeModels.some(m => m.provider === 'volcengine');
    if (needVolcengine && !hasVolcengineKey) {
      window.alert('请先填写火山引擎API密钥，才能使用豆包相关模型！');
      activeModels = activeModels.filter(m => m.provider !== 'volcengine');
      if (activeModels.length === 0) {
        setLoading(false);
        return;
      }
    }

    // 并发调用所有选中的模型，使用流式输出
    const promises = activeModels.map(async (model) => {
      const modelId = model.id;
      
      // 添加加载状态的响应
      const loadingResponse = {
        modelId,
        content: '',
        loading: true,
        timestamp: new Date(),
      };
      // 将 userMessageId 传递给 addModelResponse
      addModelResponse(modelId, userMessageId, loadingResponse);

      try {
        // 准备消息历史
        // 注意：currentSession?.messages 此时可能还没有包含最新的 userMessageId，
        // 但我们直接在这里构建完整的 messages 数组来发送给 AI 服务
        const allMessages = [...(currentSession?.messages || []), {
          id: userMessageId,
          role: 'user' as const,
          content: messageToSend,
          timestamp: new Date(),
          images: uploadedImage ? [uploadedImage] : uploadedFile ? [uploadedFile.name] : undefined,
        }];

        // 使用流式输出
        const startTime = Date.now();
        await chatService.sendMessageStream(model.provider, {
          model: model.modelId,
          messages: allMessages,
          systemPrompt,
          temperature: model.temperature,
          maxTokens: model.maxTokens,
          stream: true,
        }, (chunk) => {
          console.log(`📥 UI收到流式块 [${model.name}]:`, chunk);
          if (chunk.finished) {
            // 流式完成，更新最终状态
            console.log(`✅ UI流式完成 [${model.name}]`);
            const responseTime = Date.now() - startTime;
            updateModelResponse(modelId, userMessageId, { // 传递 userMessageId
              loading: false,
              responseTime: responseTime,
              tokens: chunk.tokens || 0,
              cost: chunk.cost || 0,
            });
            // 确保滚动到底部
            if (chatContainerRef.current) {
              const { scrollHeight, clientHeight, scrollTop } = chatContainerRef.current;
              // 只有当用户在底部附近时才自动滚动
              if (scrollHeight - scrollTop <= clientHeight + 100) { // 100px 的容差
                chatContainerRef.current.scrollTop = scrollHeight;
              }
            }
          } else {
            // 追加流式内容 - 强制立即更新UI
            console.log(`➕ UI追加内容 [${model.name}]:`, JSON.stringify(chunk.content));
            appendToModelResponse(modelId, userMessageId, chunk.content); // 传递 userMessageId
            console.log(`➕ UI追加内容后 Store状态 [${model.name}]:`, useAppStore.getState().currentSession?.responses[modelId]?.[userMessageId]?.content);
            // 确保滚动到底部
            if (chatContainerRef.current) {
              const { scrollHeight, clientHeight, scrollTop } = chatContainerRef.current;
              if (scrollHeight - scrollTop <= clientHeight + 100) { // 100px 的容差
                chatContainerRef.current.scrollTop = scrollHeight;
              }
            }
          }
        });

      } catch (error) {
        console.error(`❌ 模型响应错误 [${model.name}]:`, error);
        updateModelResponse(modelId, userMessageId, { // 传递 userMessageId
          content: '',
          loading: false,
          error: error instanceof Error ? error.message : '请求失败',
        });
      }
    });

    await Promise.allSettled(promises);
    setLoading(false);
  };

  const selectedModelConfigs = AVAILABLE_MODELS.filter(model => 
    selectedModels.includes(model.id)
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target) {
          setUploadedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
      setParsedFileContent('');
      return;
    }
    setUploadedImage(null);
    // 解析 docx
    if (file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setParsedFileContent(result.value);
      return;
    }
    // 解析 pdf
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      setParsedFileContent(text);
      return;
    }
    // 解析 txt/其它文本
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setParsedFileContent(text);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleClearHistory = () => {
    if (dontAskAgain) {
      useAppStore.getState().clearAllData();
    } else {
      setShowClearModal(true);
    }
  };

  const handleConfirmClear = () => {
    if (modalDontAskAgain) {
      setDontAskAgain(true);
      localStorage.setItem('history_clear_dont_ask', 'true');
    }
    useAppStore.getState().clearAllData();
    setShowClearModal(false);
    setModalDontAskAgain(false);
  };

  const handleCancelClear = () => {
    setShowClearModal(false);
    setModalDontAskAgain(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full"> {/* 侧边栏主容器，无滚动 */}
        {/* 侧边栏头部 */}
        <div className="p-4 border-b border-gray-200 flex items-center flex-shrink-0">
          <img src="/favicon-96x96.png" alt="logo" className="w-7 h-7 mr-2 rounded" />
          <h2 className="text-lg font-semibold text-gray-900">AI模型对比</h2>
        </div>

        {/* 新的滚动区域，包裹所有可折叠部分 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* API密钥配置 - 独立可折叠 */}
          <CollapsibleSection 
            title="API密钥配置" 
            defaultOpen={showSettings} 
            icon={<Settings size={16} className="text-gray-500" />} 
            onToggle={() => setShowSettings(!showSettings)}
            isOpen={showSettings}
          >
            <div className="space-y-3">
              {Object.keys(PROVIDERS).map((key) => {
                const typedKey = key as AIProvider;
                const provider = PROVIDERS[typedKey];
                return (
                  <div key={typedKey}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {provider.name}
                      {typedKey === 'aliyun' && (
                        <span className="text-blue-500 ml-1" title="阿里云DashScope API密钥">ℹ️</span>
                      )}
                      {typedKey === 'kimi' && (
                        <span className="text-blue-500 ml-1" title="Kimi (Moonshot) API密钥，支持流式输出">🌙</span>
                      )}
                    </label>
                    <input
                      type="password"
                      placeholder={
                        typedKey === 'aliyun' 
                          ? '输入DashScope API Key (sk-xxx格式)' 
                          : typedKey === 'kimi'
                          ? '输入Kimi API Key (sk-xxx格式，支持流式输出)'
                          : `输入${provider.name}的API密钥`
                      }
                      value={apiKeys[typedKey] || ''}
                      onChange={(e) => setApiKey(typedKey, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {apiKeys[typedKey] && (
                      <div className="mt-1 flex items-center justify-between">
                        <div className="text-xs">
                          {validateApiKey(typedKey, apiKeys[typedKey]) ? (
                            <span className="text-green-600">✓ 有效</span>
                          ) : (
                            <span className="text-red-600">✗ 格式错误</span>
                          )}
                        </div>
                        {validateApiKey(typedKey, apiKeys[typedKey]) && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => testApiConnection(typedKey)}
                              disabled={testingApi[typedKey]}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                              {testingApi[typedKey] ? '测试中...' : '测试'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* 模型选择 - 独立可折叠 */}
          <CollapsibleSection 
            title="选择模型" 
            defaultOpen={showModels} 
            onToggle={() => setShowModels(!showModels)}
            isOpen={showModels}
          >
            {/* 统一温和提示 */}
            <div className="mb-2 text-xs text-gray-500">未填写API密钥的模型不可选，请先在左侧API密钥配置中填写。</div>
            <div className="space-y-2">
              {AVAILABLE_MODELS.map((model) => {
                const disabled = !isProviderKeyFilled(model.provider);
                return (
                  <label key={model.id} className={`flex items-center space-x-2 cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => !disabled && toggleModel(model.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={disabled}
                    />
                    <span className="text-sm text-gray-700">
                      {PROVIDERS[model.provider].icon} {model.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* 系统提示词 - 独立可折叠 */}
          <CollapsibleSection 
            title="系统提示词" 
            defaultOpen={showSystemPrompt}
            onToggle={() => setShowSystemPrompt(!showSystemPrompt)}
            isOpen={showSystemPrompt}
          >
            <div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="输入系统提示词..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={15} 
              />
            </div>
          </CollapsibleSection>

          {/* 历史记录 - 独立可折叠 */}
          <CollapsibleSection 
            title={
              <div className="flex items-center justify-between w-full">
                <span>历史记录</span>
                <button
                  className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 ml-4"
                  onClick={e => {
                    e.stopPropagation();
                    handleClearHistory();
                  }}
                >
                  清空
                </button>
              </div>
            }
            defaultOpen={showHistory} 
            onToggle={() => setShowHistory(!showHistory)}
            isOpen={showHistory}
          >
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无历史对话</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`py-3 px-4 cursor-pointer hover:bg-blue-50 rounded-md transition-colors
                      ${currentSession?.id === session.id ? 'bg-blue-50' : ''}`}
                    onClick={() => loadSession(session.id)}
                  >
                    <p className="text-sm font-medium text-black truncate">
                      {session.title ? session.title : `新对话`}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">
                模型对比结果
              </h1>
              <div className="text-sm text-gray-600">
                已选择 {selectedModels.length} 个模型
              </div>
            </div>
          </div>
        </div>

        {/* 对话区域 - 占据剩余空间并可滚动 */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto pb-[10px]">
          {selectedModelConfigs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {selectedModelConfigs.map((model) => (
                <div key={model.id} className="bg-white border border-gray-200 rounded-lg flex flex-col">
                  {/* 模型头部 */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{PROVIDERS[model.provider].icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{model.name}</div>
                        <div className="text-xs text-gray-500">{PROVIDERS[model.provider].name}</div>
                      </div>
                    </div>
                  </div>

                  {/* 对话内容 */}
                  <div className="flex-1 p-4 min-h-[400px] overflow-y-auto">
                    {currentSession?.messages.map((message) => {
                      // 确保 modelResponses 存在且是 Record<string, ModelResponse> 类型
                      const modelResponses = currentSession.responses[model.id] as Record<string, ModelResponse>;
                      // 确保 messageResponse 存在且是 ModelResponse 类型
                      const messageResponse = modelResponses?.[message.id] as ModelResponse;
                      console.log(`Rendering message [${model.name}, ${message.id}]:`, messageResponse?.content);

                      return (
                        <div key={message.id} className="mb-4">
                          {/* 用户消息 */}
                          <div className="mb-2">
                            <div className="text-xs text-gray-500 mb-1">用户</div>
                            <div className="bg-blue-50 p-3 rounded-lg text-sm">
                              {message.content}
                              {message.images && message.images.length > 0 && (
                                <div className="mt-2 flex items-center space-x-2">
                                  {message.images.map((img, idx) =>
                                    img.startsWith('data:') ? (
                                      <img key={idx} src={img} alt="uploaded" className="w-10 h-10 object-cover rounded border" />
                                    ) : (
                                      <span key={idx} className="px-2 py-1 bg-gray-100 border rounded text-xs text-gray-700">已上传文档：{img}</span>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AI回复 */}
                          {messageResponse && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">
                                {model.name}
                                {messageResponse.responseTime && (
                                  <span className="ml-2">
                                    ({messageResponse.responseTime}ms)
                                  </span>
                                )}
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                                <div className="whitespace-pre-wrap">
                                  {messageResponse.loading ? (
                                    <TypewriterEffect text={messageResponse.content} />
                                  ) : messageResponse.error ? (
                                    <div className="text-red-600">
                                      错误: {messageResponse.error}
                                    </div>
                                  ) : (
                                    messageResponse.content
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={64} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  选择AI模型开始对话
                </h3>
                <p className="text-gray-600">
                  在左侧选择要对比的AI模型，配置API密钥后即可开始对话
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 输入区域 - 固定在底部 */}
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="输入您的问题..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <div className="flex flex-col space-y-2 items-end">
              <div className="flex space-x-2 mb-2">
                <button
                  onClick={createNewSession}
                  className="p-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  title="新建对话"
                >
                  <MessageSquare size={20} />
                </button>
                <label
                  htmlFor="file-upload"
                  className="p-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  title="上传图片或文档"
                >
                  <Paperclip size={20} />
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Send size={16} />
                <span>发送</span>
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center min-h-[28px]">
            <span>按 Enter 发送，Shift + Enter 换行</span>
            {/* 上传文件/图片预览区 */}
            {(uploadedImage || uploadedFile) && (
              <div className="flex items-center space-x-4 ml-4">
                {uploadedImage && (
                  <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-gray-300">
                    <img src={uploadedImage} alt="Uploaded Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setUploadedImage(null); setUploadedFile(null); setParsedFileContent(''); }}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs leading-none opacity-80 hover:opacity-100"
                      title="移除图片"
                    >
                      &times;
                    </button>
                  </div>
                )}
                {uploadedFile && !uploadedImage && (
                  <div className="relative flex items-center px-2 py-1 bg-gray-100 border border-gray-300 rounded-lg h-7">
                    <span className="mr-2 text-gray-700 text-xs truncate max-w-[100px]">{uploadedFile.name}</span>
                    <button
                      onClick={() => { setUploadedFile(null); setParsedFileContent(''); }}
                      className="ml-2 bg-red-500 text-white rounded-full p-1 text-xs leading-none opacity-80 hover:opacity-100"
                      title="移除文件"
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 清空历史弹窗 */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 w-80">
            <div className="text-lg font-semibold mb-4 text-center">是否清空历史记录？</div>
            <label className="flex items-center text-sm mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={modalDontAskAgain}
                onChange={e => setModalDontAskAgain(e.target.checked)}
                className="mr-2"
              />
              不再提醒
            </label>
            <div className="flex justify-end space-x-2">
              <button
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                onClick={handleCancelClear}
              >取消</button>
              <button
                className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white"
                onClick={handleConfirmClear}
              >确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 