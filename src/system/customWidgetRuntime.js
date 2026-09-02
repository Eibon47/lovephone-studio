import { activeCharacter } from '../apps/appData.js?v=app-config-40';
import { primaryAnniversary } from '../services/anniversaryService.js?v=app-config-44';
import { escapeHtml } from './html.js';
import { safeUploadedImage } from './icons.js?v=app-config-61';
import { validateCustomWidgetCode } from '../services/customizationModel.js?v=app-config-102';

const DESKTOP_PAGE_ROWS = 50;

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

function compositionBindingValue(element, config, osState, now = new Date()) {
  const binding = element.binding || {};
  if (!binding.source || binding.source === 'static') {
    return binding.field === 'image' ? element.asset || '' : element.content || '';
  }
  const data = dataForSource(binding.source, config, osState, now);
  if (binding.field === 'playing') return Boolean(osState.musicPlayback?.status === 'playing' || osState.musicPlaying);
  if (binding.field === 'image') return safeUploadedImage(element.asset) || safeUploadedImage(data.image);
  return data[binding.field] ?? '';
}

function compositionElementStyle(element) {
  const frame = element.frame || {};
  const style = element.style || {};
  const shadow = Number(style.shadow) || 0;
  return [
    `left:${(Number(frame.x) || 0) / 10}%`,
    `top:${(Number(frame.y) || 0) / 10}%`,
    `width:${Math.max(2, Number(frame.w) || 20) / 10}%`,
    `height:${Math.max(2, Number(frame.h) || 20) / 10}%`,
    `z-index:${Math.max(0, Number(frame.zIndex) || 0)}`,
    `transform:rotate(${Number(frame.rotation) || 0}deg)`,
    `opacity:${Math.max(0, Math.min(100, Number(style.opacity) || 0)) / 100}`,
    `color:${escapeHtml(style.color || '#183629')}`,
    `background:${escapeHtml(style.background || 'transparent')}`,
    `border:${Math.max(0, Number(style.borderWidth) || 0)}px solid ${escapeHtml(style.borderColor || '#ffffff')}`,
    `border-radius:${Math.max(0, Number(style.radius) || 0) / 10}cqw`,
    `box-shadow:0 ${shadow / 18}cqw ${shadow / 8}cqw rgba(25,42,33,.22)`,
    `font-size:clamp(8px,${Math.max(8, Number(style.fontSize) || 20) / 10}cqw,80px)`,
    `font-weight:${Number(style.fontWeight) || 400}`,
    `line-height:${Number(style.lineHeight) || 1.25}`,
    `text-align:${escapeHtml(style.textAlign || 'center')}`
  ].join(';');
}

function renderCompositionElement(widget, element, config, osState, selectedIds) {
  if (element.hidden) return '';
  if (element.type === 'group') return '';
  const dataAllowed = element.binding?.source === 'static'
    || (widget.permissions?.data || []).includes(element.binding?.source);
  const value = dataAllowed ? compositionBindingValue(element, config, osState) : '';
  const selected = selectedIds.includes(element.id);
  const className = [
    'composition-element', `composition-element-${element.type}`,
    element.type === 'shape' ? `shape-${element.style?.shape || 'rectangle'}` : '',
    selected ? 'is-selected' : '', element.locked ? 'is-locked' : ''
  ].filter(Boolean).join(' ');
  const bindingAttrs = `data-composition-binding="${escapeHtml(element.binding?.source || 'static')}:${escapeHtml(element.binding?.field || 'text')}"`;
  let content = '';
  if (element.type === 'image') {
    const source = safeUploadedImage(value) || safeUploadedImage(element.asset);
    content = source
      ? `<img src="${escapeHtml(source)}" alt="" style="object-fit:${escapeHtml(element.style?.objectFit || 'cover')}" />`
      : '<span class="composition-image-placeholder">＋<small>选择图片</small></span>';
  } else if (element.type === 'shape') {
    content = '<span class="composition-shape-fill"></span>';
  } else if (element.type === 'progress') {
    const progress = Math.max(0, Math.min(100, Number(value) || 0));
    content = `<span class="composition-progress-track"><i style="width:${progress}%"></i></span>`;
  } else if (element.type === 'musicControl') {
    const playing = osState.musicPlayback?.status === 'playing' || osState.musicPlaying;
    content = `<span>${element.action?.type === 'musicPlayPause' ? (playing ? 'Ⅱ' : '▶') : escapeHtml(element.content || '▶')}</span>`;
  } else {
    content = `<span>${escapeHtml(String(value || element.content || ''))}</span>`;
  }
  const requestedAction = element.action?.type || 'none';
  const action = requestedAction === 'none' || (widget.permissions?.actions || []).includes(requestedAction)
    ? requestedAction
    : 'none';
  const tag = action !== 'none' ? 'button' : 'div';
  return `
    <${tag}
      ${tag === 'button' ? 'type="button"' : ''}
      class="${className}"
      style="${compositionElementStyle(element)}"
      data-composition-element="${escapeHtml(element.id)}"
      data-composition-widget-element="${escapeHtml(widget.id)}"
      data-composition-parent="${escapeHtml(element.parentId || '')}"
      data-frame-x="${Number(element.frame?.x) || 0}"
      data-frame-y="${Number(element.frame?.y) || 0}"
      data-frame-w="${Number(element.frame?.w) || 100}"
      data-frame-h="${Number(element.frame?.h) || 100}"
      data-frame-rotation="${Number(element.frame?.rotation) || 0}"
      data-custom-widget-action="${escapeHtml(action)}"
      data-custom-widget-target="${escapeHtml(element.action?.target || '')}"
      ${bindingAttrs}
      ${element.locked ? 'data-composition-locked="true"' : ''}
      ${osState.widgetEditing ? 'aria-label="编辑组件元素"' : ''}
    >
      ${content}
      ${osState.widgetEditing && selected ? '<i class="composition-resize-handle" data-composition-resize></i><i class="composition-rotate-handle" data-composition-rotate></i>' : ''}
    </${tag}>`;
}

function renderCompositionWidget(widget, config, osState) {
  const selectedIds = osState.widgetEditing && osState.widgetEditorWidgetId === widget.id
    ? (osState.widgetEditorElementIds || [])
    : [];
  const canvas = widget.canvas || {};
  const canvasStyle = `--composition-bg:${escapeHtml(canvas.background || '#fffdf6')};--composition-radius:${Number(canvas.radius) || 0}px;--composition-opacity:${Math.max(0, Math.min(100, Number(canvas.opacity) || 0)) / 100};--composition-overflow:${canvas.overflow === 'visible' ? 'visible' : 'hidden'}`;
  return `
    <article
      class="desktop-widget composition-widget ${osState.widgetEditing ? 'is-editing' : ''} ${osState.widgetEditorWidgetId === widget.id ? 'is-active' : ''}"
      data-composition-widget="${escapeHtml(widget.id)}"
      style="${canvasStyle}"
    >
      <div class="composition-canvas">
        ${(widget.elements || []).map(element => renderCompositionElement(widget, element, config, osState, selectedIds)).join('')}
      </div>
      ${osState.widgetEditing ? '<button class="composition-widget-drag-handle" type="button" aria-label="移动整个组件">⋮⋮</button>' : ''}
    </article>`;
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

export function resolveCompositionBinding(element, config, osState, now) {
  return compositionBindingValue(element, config, osState, now);
}

function renderCustomWidgetItem(widget, index, config, osState, layoutOverride) {
  const layout = layoutOverride || widget.layout || {};
  const data = widget.kind === 'composition' ? null : resolveCustomWidgetData(widget, config, osState);
  const style = widget.style || {};
  const styleText = `--widget-bg:${escapeHtml(style.background)};--widget-text:${escapeHtml(style.text)};--widget-accent:${escapeHtml(style.accent)};--widget-radius:${Number(style.radius) || 0}px`;
  return `
    <div
      class="grid-stack-item ${osState.widgetEditing && osState.widgetEditorWidgetId === widget.id ? 'is-widget-active' : ''}"
      data-custom-widget-index="${index}"
      gs-x="${Number(layout.x) || 0}"
      gs-y="${Number(layout.y) || 0}"
      gs-w="${Number(layout.w) || 2}"
      gs-h="${Number(layout.h) || 2}"
      gs-min-h="2"
      gs-max-h="${Math.max(2, Math.min(24, DESKTOP_PAGE_ROWS - (Number(layout.y) || 0)))}"
    >
      <div class="grid-stack-item-content">
        ${widget.mode === 'code' ? renderCodeWidget(widget, config, osState, styleText) : widget.kind === 'composition' ? renderCompositionWidget(widget, config, osState) : `<button
          class="desktop-widget custom-desktop-widget custom-widget-${escapeHtml(widget.type)}"
          type="button"
          data-custom-widget-action="${escapeHtml(widget.action)}"
          data-custom-widget-target="${escapeHtml(widget.actionTarget)}"
          style="${styleText}"
        >
          <span class="custom-widget-label">${escapeHtml(widget.name)}</span>
          <span class="custom-widget-body">${contentForWidget(widget, data)}</span>
        </button>`}
      </div>
    </div>
  `;
}

export function getCustomWidgetEntries(config, osState) {
  const widgets = config.theme?.customization?.widgets || [];
  return widgets
    .map((widget, index) => {
      if (!widget.enabled || widget.id === 'builtin-dailyNote') return null;
      return {
        id: widget.id,
        layout: widget.layout || {},
        render: layout => renderCustomWidgetItem(widget, index, config, osState, layout)
      };
    })
    .filter(Boolean);
}

export function renderCustomWidgets(config, osState) {
  return getCustomWidgetEntries(config, osState)
    .map(entry => entry.render(entry.layout))
    .join('');
}
