const ERROR_RULES = [
  {
    pattern: /(?:401|403|unauthori[sz]ed|invalid.{0,12}(?:api.?key|token)|authentication|鉴权|密钥无效|没有访问)/i,
    message: 'API Key 无效，或当前账号没有访问这个模型的权限。'
  },
  {
    pattern: /(?:402|insufficient[_\s-]*(?:quota|balance)|billing|余额不足|欠费|充值)/i,
    message: '账户余额不足，请前往模型服务商控制台充值后重试。'
  },
  {
    pattern: /(?:404|model.{0,20}(?:not found|does not exist)|模型.{0,12}(?:不存在|未找到)|deployment.{0,12}not found)/i,
    message: '没有找到这个模型，请检查模型名称或模型是否已开通。'
  },
  {
    pattern: /(?:408|timeout|timed out|超时)/i,
    message: '模型响应超时，请稍后重试。'
  },
  {
    pattern: /(?:429|rate.?limit|too many requests|额度已用完|请求过于频繁|限流)/i,
    message: '请求过于频繁或可用额度已耗尽，请稍后重试。'
  },
  {
    pattern: /(?:500|502|503|504|service unavailable|bad gateway|模型服务暂时不可用)/i,
    message: '模型服务暂时不可用，请稍后重试。'
  }
];

export function friendlyAiError(error, fallback = 'AI 回复失败，请检查设置后重试。') {
  if (error?.name === 'AbortError') return '已停止生成。';

  const raw = String(error?.message || error || '').trim();
  if (!raw) return fallback;
  if (/已停止生成|请求已取消/i.test(raw)) return '已停止生成。';
  if (/无法连接本机 AI 服务|failed to fetch|fetch failed|networkerror|econnrefused/i.test(raw)) {
    return '无法连接本机 AI 服务，请确认服务已经启动且网络连接正常。';
  }

  const match = ERROR_RULES.find(rule => rule.pattern.test(raw));
  if (match) return match.message;
  return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw;
}
