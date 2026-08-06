import assert from 'node:assert/strict';
import test from 'node:test';
import { diaryEntryFromGoodnight, diaryMemoryEntry } from '../src/services/companionLinkService.js';

test('a diary is only added to memory through an explicit linked record', () => {
  const memory = diaryMemoryEntry({
    id: 'diary-1', title: '散步', content: '晚饭后散步', date: '2026-08-06'
  }, 'character-main');
  assert.equal(memory.sourceDiaryId, 'diary-1');
  assert.equal(memory.characterId, 'character-main');
  assert.equal(memory.type, 'event');
});

test('a goodnight check-in maps to a role-scoped diary entry', () => {
  const diary = diaryEntryFromGoodnight({
    id: 'night-1', date: '2026-08-06', mood: 'tired', note: '早点睡', message: '晚安'
  }, 'character-main');
  assert.equal(diary.sourceGoodnightId, 'night-1');
  assert.equal(diary.characterId, 'character-main');
  assert.equal(diary.mood, 'tired');
});
