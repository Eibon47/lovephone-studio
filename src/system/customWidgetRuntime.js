import { activeCharacter } from '../apps/appData.js?v=app-config-40';
import { primaryAnniversary } from '../services/anniversaryService.js?v=app-config-44';
import { escapeHtml } from './html.js';
import { safeUploadedImage } from './icons.js?v=app-config-61';
import { validateCustomWidgetCode } from '../services/customizationModel.js?v=app-config-100';

function dataForSource(source, config, osState, now = new Date()) {
  if (source === 'time') {
    return {
      primary: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      secondary: now.toLocaleDateString('zh-CN', { weekday: 'short' }),
      progress: (now.getHours() * 60 + now.getMinutes()) / 14.4
    };
  }
  if (source === 'date') {
    return {
      primary: now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
      secondary: now.toLocaleDateString('zh-CN', { weekday: 'long' }),
      progress: (now.getDate() / 31) * 100
    };
  }
  if (source === 'weather') {
    const weather = config.theme?.widgets?.weather || {};
    return {
      primary: weather.temperature || '--°',
      secondary: [weather.city, weather.condition].filter(Boolean).join(' · '),
      progress: Math.max(0, Math.min(100, Number.parseFloat(weather.temperature) || 0))
    };
  }
  if (source === 'activeCharacter') {
    const character = activeCharacter(config, osState);
    return {
      primary: character?.name || '角色',
      secondary: character?.relationship || character?.speakingStyle || '',
      image: safeUploadedImage(character?.avatar?.value),
      progress: 100
    };
  }
  if (source === 'music') {
    const track = osState.musicTrack;
    const playback = osState.musicPlayback || {};
    const duration = Number(playback.duration) || (Number(track?.duration) || 0) / 1000;
    return {
      primary: track?.name || '暂未播放',
      secondary: track?.artist || '音乐',
      image: safeUploadedImage(track?.cover),
      progress: duration ? Math.min(100, (Number(playback.position) || 0) / duration * 100) : 0
    };
  }
  if (source === 'anniversary') {
    const result = primaryAnniversary(config.apps?.anniversary?.events || []);
    return {
      primary: result?.event?.title || '纪念日',
      secondary: result?.metrics ? `${Math.abs(result.metrics.daysSince)} 天` : '尚未设置',
      progress: result?.metrics ? Math.min(100, Math.abs(result.metrics.daysSince) % 100) : 0
    };
  }
  if (source === 'diary') {
    const entry = config.apps?.diary?.entries?.[0];
    return {
      primary: entry?.title || '最近日记',
      secondary: entry?.content || entry?.summary || '还没有写日记',
      progress: Number(entry?.moodScore) || 0
    };
  }
  if (source === 'memory') {
    const entries = config.apps?.memory?.entries || [];
    return {
      primary: `${entries.length} 条记忆`,
      secondary: entries[0]?.content || '重要的事会留在这里',
      progress: Math.min(100, entries.length * 10)
    };
  }
  const entry = config.apps?.diary?.entries?.[0];
  return {
    primary: entry?.mood || entry?.moodLabel || '平静',
    secondary: '最近心情',
    progress: Number(entry?.moodScore) || 50
  };
}

function contentForWidget(widget, data) {
  const image = safeUploadedImage(widget.image) || data.image;
  if (widget.templateId === 'clock') {
    return `<span class="custom-template-clock"><strong>${escapeHtml(data.primary)}</strong><small>${escapeHtml(data.secondary)}</small></span>`;
  }
  if (widget.templateId === 'weather') {
    return `<span class="custom-template-weather"><i>☀</i><strong>${escapeHtml(data.primary)}</strong><small>${escapeHtml(data.secondary)}</small></span>`;
  }
  if (widget.templateId === 'calendar') {
    return `<span class="custom-template-calendar"><small>${escapeHtml(data.secondary)}</small><strong>${escapeHtml(data.primary)}</strong><i></i></span>`;
  }
  if (widget.templateId === 'music') {
    return `
      <span class="custom-template-music">
        <i>${image ? `<img src="${escapeHtml(image)}" alt="" />` : '♪'}</i>
        <span><strong>${escapeHtml(data.primary)}</strong><small>${escapeHtml(data.secondary)}</small></span>
        <b>◀</b><b>▶</b><b>▶|</b>
      </span>
    `;
  }
  if (widget.templateId === 'photo') {
    return image
      ? `<span class="custom-template-photo"><img src="${escapeHtml(image)}" alt="" /><small>${escapeHtml(widget.name)}</small></span>`
      : '<span class="custom-template-photo is-empty"><i>＋</i><small>上传图片</small></span>';
  }
  if (widget.templateId === 'character') {
    return `
      <span class="custom-template-character">
        <i>${image ? `<img src="${escapeHtml(image)}" alt="" />` : '♡'}</i>
        <span><small>${escapeHtml(data.secondary)}</small><strong>${escapeHtml(data.primary)}</strong><em>正在陪伴你</em></span>
      </span>
    `;
  }
  if (widget.templateId === 'anniversary') {
    return `<span class="custom-template-anniversary"><small>重要的日子</small><strong>${escapeHtml(data.primary)}</strong><em>${escapeHtml(data.secondary)}</em></span>`;
  }
  if (widget.templateId === 'actions') {
    return `<span class="custom-template-actions"><i>聊<small>聊天</small></i><i>记<small>日记</small></i><i>忆<small>记忆</small></i><i>♪<small>音乐</small></i></span>`;
  }
  if (widget.templateId === 'mood') {
    return `<span class="custom-template-mood"><small>最近心情</small><strong>${escapeHtml(data.primary)}</strong><i><b style="width:${Math.max(0, Math.min(100, data.progress || 0))}%"></b></i></span>`;
  }
  if (widget.templateId === 'note') {
    return `<span class="custom-template-note"><small>${escapeHtml(data.primary)}</small><strong>${escapeHtml(data.secondary)}</strong><i>✎</i></span>`;
  }
  if (widget.type === 'image') {
    return image
      ? `<img class="custom-widget-image" src="${escapeHtml(image)}" alt="" />`
      : `<span class="custom-widget-placeholder">${escapeHtml(data.primary)}</span>`;
  }
  if (widget.type === 'progress') {
    return `
      <strong>${escapeHtml(`${widget.prefix}${data.primary}${widget.suffix}`)}</strong>
      <small>${escapeHtml(data.secondary)}</small>
      <span class="custom-widget-progress"><i style="width:${Math.max(0, Math.min(100, data.progress || 0))}%"></i></span>
    `;
  }
  if (widget.type === 'list') {
    const items = String(data.secondary || '').split(/[，,、·]/).filter(Boolean).slice(0, 3);
    return `
      <strong>${escapeHtml(`${widget.prefix}${data.primary}${widget.suffix}`)}</strong>
      <ul>${items.map(item => `<li>${escapeHtml(item.trim())}</li>`).join('')}</ul>
    `;
  }
  return `
    <strong>${escapeHtml(`${widget.prefix}${data.primary}${widget.suffix}`)}</strong>
    <small>${escapeHtml(data.secondary)}</small>
  `;
}

function inlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function sandboxDocument(widget, data) {
  const result = validateCustomWidgetCode(widget.code);
  if (!result.valid) return '';
  const permissions = widget.code || {};
  const payload = {
    id: widget.id,
    html: result.code.html,
    css: result.code.css,
    data,
    assets: widget.assets || {},
    dataPermissions: permissions.dataPermissions || [],
    actionPermissions: permissions.actionPermissions || []
  };
  const script = result.code.js.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; img-src data:; media-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline'; script-src 'nonce-lovephone-widget-sandbox'"><style>html,body,#widget-root{width:100%;height:100%;margin:0;overflow:hidden}*{box-sizing:border-box}body{font:13px/1.4 system-ui,sans-serif;background:transparent}button{font:inherit;cursor:pointer}</style></head><body><div id="widget-root"></div><script nonce="lovephone-widget-sandbox">
(()=>{const state=${inlineJson(payload)};
const root=document.getElementById('widget-root');
root.innerHTML=state.html;
const style=document.createElement('style');style.textContent=state.css;document.head.appendChild(style);
const send=(action,target='')=>{if(state.actionPermissions.includes(action)){parent.postMessage({source:'lovephone-widget',widgetId:state.id,type:'action',action,target},'*')}};
globalThis.widget=Object.freeze({
  data:name=>state.dataPermissions.includes(name)?state.data[name]??null:null,
  asset:name=>typeof name==='string'&&Object.hasOwn(state.assets,name)?state.assets[name]:null,
  action:send,
  openApp:id=>send('openApp',id),openChat:id=>send('openChat',id||''),openAnniversary:()=>send('openAnniversary'),createDiary:()=>send('createDiary'),switchCharacter:id=>send('switchCharacter',id),
  music:Object.freeze({playPause:()=>send('musicPlayPause'),previous:()=>send('musicPrevious'),next:()=>send('musicNext')})
});
addEventListener('error',event=>{const box=document.createElement('pre');box.textContent='代码错误：'+event.message;box.style.cssText='margin:8px;color:#a33;white-space:pre-wrap';root.replaceChildren(box)});})();
</script><script nonce="lovephone-widget-sandbox">${script}</script></body></html>`;
}

function renderCodeWidget(widget, config, osState, style) {
  const validation = validateCustomWidgetCode(widget.code);
  if (!validation.valid) {
    return `<div class="desktop-widget custom-desktop-widget custom-code-widget is-invalid" style="${style}"><strong>代码未通过检查</strong><small>${escapeHtml(validation.errors[0])}</small></div>`;
  }
  const permittedData = {};
  (widget.code?.dataPermissions || []).forEach(source => {
    permittedData[source] = resolveCustomWidgetData({ dataSource: source }, config, osState);
  });
  const srcdoc = sandboxDocument(widget, permittedData);
  return `
    <div class="desktop-widget custom-desktop-widget custom-code-widget" style="${style}">
      <iframe
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        title="${escapeHtml(widget.name)}"
        data-custom-widget-frame="${escapeHtml(widget.id)}"
        srcdoc="${escapeHtml(srcdoc)}"
      ></iframe>
      <span class="custom-widget-drag-handle" aria-hidden="true">⋮⋮</span>
    </div>
  `;
}

export function resolveCustomWidgetData(widget, config, osState, now) {
  return dataForSource(widget.dataSource, config, osState, now);
}

export function renderCustomWidgets(config, osState) {
  const widgets = config.theme?.customization?.widgets || [];
  return widgets
    .map((widget, index) => {
      if (!widget.enabled) return '';
      const layout = widget.layout || {};
      const data = resolveCustomWidgetData(widget, config, osState);
      const style = widget.style || {};
      const styleText = `--widget-bg:${escapeHtml(style.background)};--widget-text:${escapeHtml(style.text)};--widget-accent:${escapeHtml(style.accent)};--widget-radius:${Number(style.radius) || 0}px`;
      return `
        <div
          class="grid-stack-item"
          data-custom-widget-index="${index}"
          gs-x="${Number(layout.x) || 0}"
          gs-y="${Number(layout.y) || 0}"
          gs-w="${Number(layout.w) || 2}"
          gs-h="${Number(layout.h) || 2}"
        >
          <div class="grid-stack-item-content">
            ${widget.mode === 'code' ? renderCodeWidget(widget, config, osState, styleText) : `<button
              class="desktop-widget custom-desktop-widget custom-widget-${escapeHtml(widget.type)}"
              type="button"
              data-custom-widget-action="${escapeHtml(widget.action)}"
              data-custom-widget-target="${escapeHtml(widget.actionTarget)}"
              style="${styleText}"
            >
              <span class="custom-widget-label">${escapeHtml(widget.name)}</span>
              ${contentForWidget(widget, data)}
            </button>`}
          </div>
        </div>
      `;
    })
    .join('');
}
