const STOP_WORDS = new Set(['这个', '那个', '然后', '就是', '还是', '可以', '因为', '所以', '一个', '没有', '什么', '怎么', '我们', '你们', '他们']);

function clean(value, max = 2000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function extractMemoryKeywords(value) {
  const source = clean(value, 4000).toLowerCase();
  const latin = source.match(/[a-z0-9][a-z0-9_-]{1,24}/g) || [];
  const chineseRuns = source.match(/[\u3400-\u9fff]{2,12}/g) || [];
  const chinese = chineseRuns.flatMap(run => {
    if (run.length <= 4) return [run];
    const parts = [];
    for (let i = 0; i < run.length - 1; i += 1) parts.push(run.slice(i, i + 2));
    return parts;
  });
  return [...new Set([...latin, ...chinese].filter(item => !STOP_WORDS.has(item)))].slice(0, 30);
}

export function normalizeMemoryEntry(entry = {}, fallbackCharacterId = 'character-main') {
  const now = new Date().toISOString();
  const title = clean(entry.title, 80);
  const content = clean(entry.content, 1500);
  return {
    ...entry,
    id: clean(entry.id, 120) || `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    characterId: clean(entry.characterId, 80) || fallbackCharacterId,
    type: clean(entry.type, 30) || 'event',
    title,
    content,
    importance: Math.max(1, Math.min(5, Number(entry.importance) || 3)),
    expiresAt: entry.expiresAt && Number.isFinite(Date.parse(entry.expiresAt)) ? new Date(entry.expiresAt).toISOString() : '',
    keywords: [...new Set((Array.isArray(entry.keywords) ? entry.keywords : extractMemoryKeywords(`${title} ${content}`)).map(item => clean(item, 30)).filter(Boolean))].slice(0, 30),
    sourceRef: entry.sourceRef && typeof entry.sourceRef === 'object' ? {
      appId: clean(entry.sourceRef.appId, 30),
      sourceId: clean(entry.sourceRef.sourceId, 120),
      label: clean(entry.sourceRef.label, 80)
    } : null,
    createdAt: entry.createdAt || entry.date || now,
    updatedAt: entry.updatedAt || entry.createdAt || entry.date || now
  };
}

export function memorySimilarity(left, right) {
  const a = new Set(extractMemoryKeywords(`${left?.title || ''} ${left?.content || ''}`));
  const b = new Set(extractMemoryKeywords(`${right?.title || ''} ${right?.content || ''}`));
  if (!a.size || !b.size) return clean(left?.title).toLowerCase() === clean(right?.title).toLowerCase() ? 1 : 0;
  const shared = [...a].filter(item => b.has(item)).length;
  return shared / Math.max(a.size, b.size);
}

export function retrieveRelevantMemories(entries, options = {}) {
  const now = Date.parse(options.now || new Date().toISOString());
  const query = clean(options.query, 2000);
  const queryKeywords = extractMemoryKeywords(query);
  const scored = (entries || [])
    .map(entry => normalizeMemoryEntry(entry, options.characterId))
    .filter(entry => entry.characterId === options.characterId && (!entry.expiresAt || Date.parse(entry.expiresAt) > now))
    .map(entry => {
      const title = entry.title.toLowerCase();
      const content = entry.content.toLowerCase();
      let score = entry.importance * 2;
      queryKeywords.forEach(keyword => {
        if (title.includes(keyword)) score += 8;
        if (entry.keywords.includes(keyword)) score += 5;
        if (content.includes(keyword)) score += 3;
      });
      const ageDays = Math.max(0, (now - Date.parse(entry.updatedAt || entry.createdAt)) / 86400000);
      score += Math.max(0, 3 - ageDays / 30);
      return { entry, score };
    })
    .filter(item => queryKeywords.length === 0 || item.score > item.entry.importance * 2)
    .sort((left, right) => right.score - left.score);

  const selected = [];
  let used = 0;
  for (const item of scored) {
    const length = item.entry.title.length + item.entry.content.length;
    if (selected.length >= (options.limit || 6) || used + length > (options.maxChars || 1500)) continue;
    selected.push(item.entry);
    used += length;
  }
  return selected;
}

export function mergeMemoryEntries(left, right) {
  const a = normalizeMemoryEntry(left, right.characterId);
  const b = normalizeMemoryEntry(right, left.characterId);
  const expiry = [a.expiresAt, b.expiresAt].filter(Boolean).sort().at(-1) || '';
  return normalizeMemoryEntry({
    ...a,
    title: b.title.length > a.title.length ? b.title : a.title,
    content: [...new Set([a.content, b.content].filter(Boolean))].join('；'),
    importance: Math.max(a.importance, b.importance),
    expiresAt: expiry,
    keywords: [...new Set([...a.keywords, ...b.keywords])],
    sourceRefs: [...(a.sourceRefs || (a.sourceRef ? [a.sourceRef] : [])), ...(b.sourceRefs || (b.sourceRef ? [b.sourceRef] : []))],
    updatedAt: new Date().toISOString()
  }, a.characterId);
}
