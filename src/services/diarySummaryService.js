import { streamAiChat } from './aiService.js?v=app-config-57';
import { resolveCharacterAiProfile } from './aiProfileScope.js?v=app-config-45';

const MAX_SUMMARY_LENGTH = 160;

function normalizeSummary(value) {
  return String(value || '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUMMARY_LENGTH);
}

export function diaryProviderId(config, character) {
  return resolveCharacterAiProfile(config, character).providerId;
}

export function buildDiarySummaryRequest(config, {
  character,
  date,
  moodLabel,
  title,
  content
}) {
  const profile = resolveCharacterAiProfile(config, character);
  return {
    providerId: profile.providerId,
    profileId: profile.profileId,
    system: [
      '你是日记整理助手。',
      '请用自然、克制的中文，把用户这篇日记总结为一到两句话。',
      '保留真实事件和情绪，不虚构细节，不进行诊断，不说教。',
      `总结不超过 ${MAX_SUMMARY_LENGTH} 个字符，只输出总结正文，不要标题、引号或前缀。`
    ].join('\n'),
    messages: [{
      role: 'user',
      content: [
        `日期：${date}`,
        `心情：${moodLabel}`,
        `标题：${title}`,
        `正文：${content}`
      ].join('\n')
    }]
  };
}

export async function generateDiarySummary(config, input, handlers = {}) {
  const result = await streamAiChat(
    config,
    buildDiarySummaryRequest(config, input),
    { signal: handlers.signal }
  );
  const summary = normalizeSummary(result);
  if (!summary) throw new Error('模型没有生成可用的日记总结');
  return summary;
}
