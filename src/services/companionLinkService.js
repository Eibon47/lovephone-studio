import { makeId } from '../apps/appData.js';

export function diaryMemoryEntry(entry, characterId) {
  return {
    id: makeId('memory'),
    type: 'event',
    title: entry.title,
    content: entry.aiSummary || entry.content,
    date: entry.date,
    characterId,
    source: 'diary',
    sourceDiaryId: entry.id
  };
}

export function diaryEntryFromGoodnight(nightEntry, characterId) {
  const moodLabels = {
    peaceful: '平静',
    happy: '开心',
    tired: '疲惫',
    heavy: '心事很多'
  };
  return {
    id: makeId('diary'),
    date: nightEntry.date,
    mood: nightEntry.mood === 'happy' ? 'good' : nightEntry.mood === 'tired' ? 'tired' : nightEntry.mood === 'heavy' ? 'sad' : 'calm',
    moodScore: nightEntry.mood === 'happy' ? 72 : nightEntry.mood === 'tired' ? 38 : nightEntry.mood === 'heavy' ? 22 : 58,
    title: '今晚的小结',
    content: nightEntry.note || nightEntry.message || '完成了今晚的睡前打卡。',
    comment: '',
    characterId,
    source: 'goodnight',
    sourceGoodnightId: nightEntry.id,
    sourceMoodLabel: moodLabels[nightEntry.mood] || ''
  };
}
