export const AI_PROVIDER_CATALOG = [
  {
    id: 'openai',
    name: 'OpenAI',
    group: '国际模型',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-4.1-mini']
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    group: '国际模型',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001']
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    group: '国际模型',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-pro']
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    group: '国际模型',
    protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4-1-fast-reasoning', 'grok-4-1-fast-non-reasoning']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'volcengine',
    name: '火山引擎方舟 / 豆包',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260215',
      'doubao-seed-1-8-251228'
    ]
  },
  {
    id: 'qwen',
    name: '阿里云百炼 / 通义千问',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max']
  },
  {
    id: 'kimi',
    name: 'Moonshot / Kimi',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.5', 'moonshot-v1-32k', 'moonshot-v1-128k']
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4.5', 'glm-4-plus', 'glm-4-flash']
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://api.minimaxi.com/v1',
    models: ['MiniMax-M2.5', 'MiniMax-Text-01']
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: ['hunyuan-turbos-latest', 'hunyuan-lite']
  },
  {
    id: 'qianfan',
    name: '百度千帆 / 文心',
    group: '国内模型',
    protocol: 'openai',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: ['ernie-4.5-turbo-128k', 'ernie-speed-128k']
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    group: '聚合与本地',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3.2', 'Qwen/Qwen3-32B']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    group: '聚合与本地',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-5.4-mini', 'anthropic/claude-sonnet-4.6']
  },
  {
    id: 'ollama',
    name: 'Ollama 本地模型',
    group: '聚合与本地',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    models: ['qwen3:8b', 'llama3.3', 'deepseek-r1:8b'],
    apiKeyOptional: true
  },
  {
    id: 'custom',
    name: '其他服务商',
    group: '聚合与本地',
    protocol: 'openai',
    baseUrl: '',
    models: [],
    customBaseUrl: true
  }
];

export const DEFAULT_AI_PROVIDERS = [
  'deepseek',
  'volcengine',
  'qwen',
  'kimi',
  'zhipu',
  'openai',
  'anthropic',
  'gemini',
  'custom'
];

export function getAiProvider(providerId) {
  return AI_PROVIDER_CATALOG.find(provider => provider.id === providerId);
}

export function selectedAiProviders(config) {
  const selected = Array.isArray(config.aiProviders?.selected)
    ? config.aiProviders.selected
    : DEFAULT_AI_PROVIDERS;
  const selectedSet = new Set(selected);
  return AI_PROVIDER_CATALOG.filter(provider => selectedSet.has(provider.id));
}
