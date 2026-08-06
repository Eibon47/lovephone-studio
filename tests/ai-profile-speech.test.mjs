import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCharacterAiProfile,
  roleProfileId
} from '../src/services/aiProfileScope.js';
import {
  createSpeechRecognition,
  speechRecognitionErrorMessage,
  speechRecognitionSupported
} from '../src/services/speechRecognitionService.js';
import { cloneConfig, defaultConfig } from '../src/config/defaultConfig.js';
import { normalizeConfig } from '../src/config/schema.js';

test('each character resolves to a stable independent AI profile', () => {
  const config = cloneConfig(defaultConfig);
  config.apps.settings.perRoleApi = true;
  config.aiProviders.activeId = 'deepseek';
  const first = { ...config.character, id: 'character-one', aiProviderId: 'custom' };
  const second = { ...config.character, id: 'character-two', aiProviderId: 'custom' };

  assert.deepEqual(resolveCharacterAiProfile(config, first), {
    providerId: 'custom',
    profileId: 'role-character-one',
    scope: 'character'
  });
  assert.deepEqual(resolveCharacterAiProfile(config, second), {
    providerId: 'custom',
    profileId: 'role-character-two',
    scope: 'character'
  });
  assert.notEqual(roleProfileId(first), roleProfileId(second));

  first.aiProviderId = '';
  assert.deepEqual(resolveCharacterAiProfile(config, first), {
    providerId: 'deepseek',
    profileId: 'deepseek',
    scope: 'global'
  });
});

test('role AI metadata survives normalization without any API key field', () => {
  const source = cloneConfig(defaultConfig);
  source.character.aiProviderId = 'custom';
  source.character.aiProfiles = {
    custom: { model: 'role-model', baseUrl: 'http://127.0.0.1:5190', apiKey: 'must-be-removed' }
  };
  source.aiProviders.profiles.custom = {
    model: 'global-model', baseUrl: 'https://api.example.com/v1', apiKey: 'must-be-removed-too'
  };
  const config = normalizeConfig(source);
  assert.equal(config.character.aiProfiles.custom.model, 'role-model');
  assert.equal(config.aiProviders.profiles.custom.model, 'global-model');
  assert.doesNotMatch(JSON.stringify(config), /"apiKey"\s*:/);
});

test('speech recognition emits interim and final Chinese text', () => {
  const transcripts = [];
  let started = false;
  let ended = false;
  class FakeRecognition {
    start() {
      this.onstart();
      const interim = [{ transcript: '你好' }];
      interim.isFinal = false;
      this.onresult({ resultIndex: 0, results: [interim] });
      const final = [{ transcript: '你好，小满' }];
      final.isFinal = true;
      this.onresult({ resultIndex: 0, results: [final] });
      this.onend();
    }
    stop() {}
    abort() {}
  }
  const scope = { SpeechRecognition: FakeRecognition };
  assert.equal(speechRecognitionSupported(scope), true);
  const controller = createSpeechRecognition({
    onStart: () => { started = true; },
    onTranscript: value => transcripts.push(value),
    onEnd: () => { ended = true; }
  }, scope);
  controller.start();

  assert.equal(started, true);
  assert.equal(ended, true);
  assert.equal(transcripts[0].interimText, '你好');
  assert.equal(transcripts[1].finalText, '你好，小满');
  assert.match(speechRecognitionErrorMessage('not-allowed'), /麦克风权限/);
});
