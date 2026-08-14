import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assistantAttachmentServiceForTest,
  textAttachmentsForRequest
} from '../src/services/assistantAttachmentService.js';

test('assistant attachments recognize only supported local formats', () => {
  assert.equal(assistantAttachmentServiceForTest.attachmentKind({ name: 'icon.png', type: 'image/png' }), 'image');
  assert.equal(assistantAttachmentServiceForTest.attachmentKind({ name: 'theme.lptheme.zip', type: 'application/zip' }), 'theme-package');
  assert.equal(assistantAttachmentServiceForTest.attachmentKind({ name: 'demo.lovephone-app.zip', type: 'application/zip' }), 'app-package');
  assert.equal(assistantAttachmentServiceForTest.attachmentKind({ name: 'widget.js', type: 'text/javascript' }), 'text');
  assert.equal(assistantAttachmentServiceForTest.attachmentKind({ name: 'private.pdf', type: 'application/pdf' }), '');
});

test('only text attachment bodies are prepared for AI requests', () => {
  const attachments = [
    { id: 'attachment-1', kind: 'image', name: 'photo.png', image: 'data:image/png;base64,PRIVATE_IMAGE' },
    { id: 'attachment-2', kind: 'text', name: 'widget.js', type: 'text/javascript', text: 'const value = 1;' }
  ];
  const payload = textAttachmentsForRequest(attachments);
  assert.deepEqual(payload, [{ id: 'attachment-2', name: 'widget.js', type: 'text/javascript', text: 'const value = 1;' }]);
  assert.equal(JSON.stringify(payload).includes('PRIVATE_IMAGE'), false);
});

test('secret-like text attachments are blocked without echoing the secret', () => {
  assert.throws(() => textAttachmentsForRequest([{
    id: 'attachment-1', kind: 'text', name: 'secret.env', type: 'text/plain', text: 'API_KEY=sk-super-secret-value-123456789'
  }]), error => {
    assert.match(error.message, /第 1 行/);
    assert.doesNotMatch(error.message, /super-secret/);
    return true;
  });
});

test('text attachment limits fail instead of silently truncating content', () => {
  assert.throws(() => textAttachmentsForRequest([
    { id: 'a', kind: 'text', name: 'a.txt', text: 'a'.repeat(20001) },
    { id: 'b', kind: 'text', name: 'b.txt', text: 'b'.repeat(20001) }
  ]), /40,000/);
});
