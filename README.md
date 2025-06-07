# AI模型对比工具

**AI模型对比工具** 是一个现代化的 Web 应用，专为开发者、AI从业者和爱好者设计，帮助用户便捷地对比多个主流大模型（如 DeepSeek、阿里云通义千问、火山引擎豆包等）的实际效果。用户可同时调用多个模型API，进行多轮对话、并排展示结果，直观对比不同模型的表现。工具支持本地安全存储API密钥、自动保存对话历史、系统提示词自定义、文档/图片上传等实用功能，界面美观，体验流畅。

## 🚀 功能特色

- **🔄 多模型并发对比** - 同时调用多个AI模型，快速对比效果
- **💬 多轮对话支持** - 保持上下文的连续对话
- **🎨 现代化界面** - 类似DeepSeek的美观对话界面
- **💾 本地数据存储** - 自动保存对话历史和配置
- **🔒 安全可靠** - API密钥本地加密存储
- **🧪 连接测试** - 一键测试API连接状态

## 🤖 支持的AI模型

### DeepSeek
- DeepSeek Chat
- DeepSeek Coder  
- DeepSeek R1 (Reasoner)

### 阿里云通义千问
- 通义千问 Turbo
- 通义千问 Plus
- 通义千问 Max
- 通义千问2-57B

### 火山引擎豆包
- 豆包 Pro 32K
- 豆包 Pro 256K
- 豆包 Vision Pro (支持图片)

## 🛠 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS
- **状态管理**: Zustand
- **构建工具**: Vite
- **图标**: Lucide React
- **HTTP客户端**: Axios

## 📦 安装和运行

### 本地开发

```bash
# 克隆项目
git clone https://github.com/pite1376/model-test-html.github.io.git
cd model-test-html.github.io

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 开始使用

### 生产构建

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 🔧 使用指南

### 1. 配置API密钥

在左侧设置面板中配置各厂商的API密钥：

- **DeepSeek**: `sk-xxxxxxxxxx` 格式
- **阿里云**: DashScope API Key (`sk-xxxxxxxxxx` 格式) 
- **火山引擎**: API密钥

### 2. 选择模型

勾选要对比的AI模型，支持同时选择多个模型。

### 3. 设置系统提示词

自定义AI的角色和行为指令。

### 4. 开始对话

输入问题，查看各模型的回答对比效果。

## 🔑 API密钥获取

### DeepSeek
访问 [DeepSeek开放平台](https://platform.deepseek.com/) 获取API密钥

### 阿里云通义千问  
访问 [阿里云百练控制台](https://bailian.console.aliyun.com/) 获取DashScope API密钥

### 火山引擎豆包
访问 [火山引擎控制台](https://console.volcengine.com/) 获取API密钥

## 🚀 在线体验

访问 [AI模型对比工具](https://pite1376.github.io/model-test-html.github.io/) 在线使用

## 📄 开源协议

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

如有问题或建议，请通过 GitHub Issues 联系。

---

⭐ 如果这个项目对您有帮助，请给个Star支持一下！
