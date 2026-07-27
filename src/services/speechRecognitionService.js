export function speechRecognitionErrorMessage(code) {
  const messages = {
    'not-allowed': '麦克风权限被拒绝，请在浏览器的网站设置中允许。',
    'service-not-allowed': '浏览器没有允许语音识别服务。',
    'audio-capture': '没有检测到可用的麦克风。',
    network: '语音识别网络不可用，请检查网络后重试。',
    'no-speech': '没有听清，请靠近麦克风再试一次。',
    aborted: '语音输入已停止。'
  };
  return messages[code] || '语音识别失败，请稍后重试。';
}

export function speechRecognitionSupported(scope = globalThis) {
  return Boolean(scope?.SpeechRecognition || scope?.webkitSpeechRecognition);
}

export function createSpeechRecognition(options = {}, scope = globalThis) {
  const Recognition = scope?.SpeechRecognition || scope?.webkitSpeechRecognition;
  if (!Recognition) throw new Error('当前浏览器不支持语音输入，请使用最新版 Chrome 或 Edge。');

  const recognition = new Recognition();
  recognition.lang = options.lang || 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  let finalText = '';

  recognition.onstart = () => options.onStart?.();
  recognition.onresult = event => {
    let interimText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = String(event.results[index]?.[0]?.transcript || '').trim();
      if (!transcript) continue;
      if (event.results[index].isFinal) {
        finalText = `${finalText} ${transcript}`.trim();
      } else {
        interimText = `${interimText} ${transcript}`.trim();
      }
    }
    options.onTranscript?.({ finalText, interimText });
  };
  recognition.onerror = event => {
    options.onError?.(speechRecognitionErrorMessage(event.error), event.error);
  };
  recognition.onend = () => options.onEnd?.({ finalText });

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    recognition
  };
}
