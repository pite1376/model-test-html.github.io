// 生成唯一ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 格式化时间
export const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// 格式化相对时间
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return '刚刚';
  } else if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 30) {
    return `${diffDays}天前`;
  } else {
    return formatTime(date);
  }
};

// 格式化token数量
export const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
};

// 格式化成本
export const formatCost = (cost: number): string => {
  if (cost === 0) return '免费';
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(2)}‰`;
  }
  return `$${cost.toFixed(4)}`;
};

// 复制到剪贴板
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};

// 下载文件
export const downloadFile = (content: string, filename: string, type = 'text/plain'): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 验证API密钥格式
export const validateApiKey = (provider: string, key: string): boolean => {
  if (!key || key.trim().length === 0) {
    return false;
  }

  switch (provider) {
    case 'deepseek':
      return key.startsWith('sk-');
    case 'aliyun':
      // 阿里云DashScope API Key通常是sk-开头或者是长字符串
      return key.length > 20 && (key.startsWith('sk-') || /^[a-zA-Z0-9_-]+$/.test(key));
    case 'volcengine':
      return key.length > 10; // 火山引擎API密钥
    case 'kimi':
      return key.startsWith('sk-'); // Kimi (Moonshot) API Key 格式
    case 'claude':
      // Extremely loose validation: just check if it's a non-empty string after trim
      return key.trim().length > 0;
    default:
      return false;
  }
};

// 截断文本
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
};

// 获取文件的base64编码
export const getFileBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // 移除data:image/xxx;base64,前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

// 检查是否为图片文件
export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

// 压缩图片
export const compressImage = (file: File, maxWidth = 800, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      const { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxWidth / height);
      
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.readAsDataURL(blob);
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.src = URL.createObjectURL(file);
  });
}; 