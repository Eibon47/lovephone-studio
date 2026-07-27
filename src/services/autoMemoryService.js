import { streamAiChat } from './aiService.js?v=app-config-57';

const memoryTypes = new Set(['profile', 'preferences', 'relationship', 'event']);

export function parseMemoryCandidate(rawText) {
  const cleaned = String(rawText || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return null;

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!parsed?.shouldSave) return null;
  const title = String(parsed.title || '').trim().slice(0, 30);
  const content = String(parsed.content || '').trim().slice(0, 240);
  if (!title || !content) return null;
  return {
    type: memoryTypes.has(parsed.type) ? parsed.type : 'event',
    title,
    content
  };
}

export function isDuplicateMemory(entries, candidate, characterId) {
  const normalized = value => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  const candidateTitle = normalized(candidate.title);
  const candidateContent = normalized(candidate.content);
  return entries.some(entry => (
    entry.characterId === characterId
    && (
      normalized(entry.content) === candidateContent
      || (normalized(entry.title) === candidateTitle && candidateTitle.length >= 4)
    )
  ));
}

export async function extractAutoMemory(config, {
  providerId,
  profileId,
  character,
  userText,
  assistantText,
  signal
}) {
  const response = await streamAiChat(config, {
    providerId,
    profileId,
    system: [
      '你是陪伴应用的记忆筛选器。',
      '判断本轮对话是否包含未来仍有用、且用户明确表达的长期信息。',
      '只保存：用户身份资料、稳定偏好、重要关系信息、明确的重要事件或约定。',
      '不要保存：临时情绪、寒暄、普通日常、模型自己的推测、敏感账号密钥或支付信息。',
      '不要把角色回复里的虚构内容当作用户事实。',
      '只输出一行 JSON，不要 Markdown。',
      '无需保存时输出：{"shouldSave":false}',
      '需要保存时输出：{"shouldSave":true,"type":"profile|preferences|relationship|event","title":"不超过15字","content":"简洁、客观的用户事实"}'
    ].join('\n'),
    messages: [{
      role: 'user',
      content: [
        `当前角色：${character.name}`,
        `用户说：${userText}`,
        `角色回复：${assistantText}`
      ].join('\n')
    }]
  }, { signal });

  return parseMemoryCandidate(response);
}
