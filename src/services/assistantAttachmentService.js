import { readOptimizedImage, readSquareImage } from './imageUploadService.js';

export const ASSISTANT_ATTACHMENT_LIMITS = Object.freeze({
  count: 8,
  textChars: 20000,
  totalTextChars: 40000
});

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'html', 'css', 'js', 'mjs', 'json']);
const PACKAGE_SUFFIXES = ['.lovephone-app.zip', '.lptheme.zip'];

function extensionOf(name) {
  return String(name || '').toLowerCase().split('.').pop() || '';
}

function safeName(name) {
  return String(name || '未命名文件').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 160) || '未命名文件';
}

export function attachmentKind(file) {
  const name = safeName(file?.name).toLowerCase();
  if (IMAGE_TYPES.has(file?.type)) return 'image';
  if (PACKAGE_SUFFIXES.some(suffix => name.endsWith(suffix))) {
    return name.endsWith('.lovephone-app.zip') ? 'app-package' : 'theme-package';
  }
  if (name.endsWith('.zip')) return 'package';
  if (TEXT_EXTENSIONS.has(extensionOf(name))) return 'text';
  return '';
}

export function scanAssistantTextSecrets(text) {
  const patterns = [
    { type: '私钥', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
    { type: 'Bearer Token', pattern: /\bBearer\s+[a-z0-9._~+\/-]{16,}/i },
    { type: 'API Key', pattern: /\b(?:sk|key|token)-[a-z0-9_-]{16,}/i },
    { type: '密钥字段', pattern: /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|cookie)\s*[:=]\s*['"]?[^\s'"]{8,}/i }
  ];
  return String(text || '').split(/\r?\n/).flatMap((line, index) => {
    const match = patterns.find(item => item.pattern.test(line));
    return match ? [{ type: match.type, line: index + 1 }] : [];
  }).slice(0, 12);
}

export function assistantAttachmentSummary(attachment) {
  return {
    id: attachment.id,
    label: attachment.label,
    name: attachment.name,
    kind: attachment.kind,
    type: attachment.type,
    size: attachment.size,
    width: attachment.width || 0,
    height: attachment.height || 0
  };
}

export function textAttachmentsForRequest(attachments = []) {
  const textAttachments = attachments.filter(item => item.kind === 'text');
  const total = textAttachments.reduce((sum, item) => sum + String(item.text || '').length, 0);
  if (total > ASSISTANT_ATTACHMENT_LIMITS.totalTextChars) {
    throw new Error('本次文本附件合计超过 40,000 个字符，请拆分后再发送。');
  }
  for (const attachment of textAttachments) {
    const findings = scanAssistantTextSecrets(attachment.text);
    if (findings.length) {
      const lines = [...new Set(findings.map(item => item.line))].slice(0, 6).join('、');
      throw new Error(`“${attachment.name}”疑似包含密钥或密码（第 ${lines} 行），为保护隐私已阻止发送。`);
    }
  }
  return textAttachments.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type || 'text/plain',
    text: item.text
  }));
}

async function imageDimensions(file) {
  if (typeof createImageBitmap !== 'function') return { width: 0, height: 0 };
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return result;
}

export async function createAssistantAttachment(file, index = 0) {
  const kind = attachmentKind(file);
  if (!kind) throw new Error('不支持这个文件。请选择图片、文本代码、主题包或自定义 App 包。');
  const name = safeName(file.name);
  const base = {
    id: `attachment-${Date.now()}-${index + 1}`,
    label: `附件 ${index + 1}`,
    name,
    kind,
    type: String(file.type || '').slice(0, 100),
    size: Number(file.size) || 0,
    status: kind === 'text' ? '发送时会交给 AI' : kind === 'image' ? '仅本地使用' : '等待本地安全预检'
  };
  if (kind === 'image') {
    const [image, squareImage, dimensions] = await Promise.all([
      readOptimizedImage(file, 1200),
      readSquareImage(file, 512),
      imageDimensions(file)
    ]);
    return { ...base, image, squareImage, ...dimensions };
  }
  if (kind === 'text') {
    const text = await file.text();
    if (text.length > ASSISTANT_ATTACHMENT_LIMITS.textChars) {
      throw new Error(`“${name}”超过 20,000 个字符，请拆分后再上传。`);
    }
    return { ...base, text, findings: scanAssistantTextSecrets(text) };
  }
  return { ...base, file };
}

export async function addAssistantFiles(current = [], files = []) {
  const incoming = [...files];
  if (current.length + incoming.length > ASSISTANT_ATTACHMENT_LIMITS.count) {
    throw new Error('一次最多添加 8 个附件。');
  }
  const duplicateNames = new Set(current.map(item => `${item.name}:${item.size}`));
  const result = [...current];
  for (const file of incoming) {
    const duplicateKey = `${safeName(file.name)}:${Number(file.size) || 0}`;
    if (duplicateNames.has(duplicateKey)) throw new Error(`“${safeName(file.name)}”已经添加过了。`);
    const attachment = await createAssistantAttachment(file, result.length);
    duplicateNames.add(duplicateKey);
    result.push(attachment);
  }
  return result.map((item, index) => ({ ...item, label: `附件 ${index + 1}` }));
}

export const assistantAttachmentServiceForTest = {
  attachmentKind,
  scanAssistantTextSecrets,
  textAttachmentsForRequest
};
