function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function frameFromNode(node) {
  return {
    x: Number(node.dataset.frameX) || 0,
    y: Number(node.dataset.frameY) || 0,
    w: Number(node.dataset.frameW) || 100,
    h: Number(node.dataset.frameH) || 100,
    rotation: Number(node.dataset.frameRotation) || 0
  };
}

function applyFrame(node, frame) {
  node.style.left = `${frame.x / 10}%`;
  node.style.top = `${frame.y / 10}%`;
  node.style.width = `${frame.w / 10}%`;
  node.style.height = `${frame.h / 10}%`;
  node.style.transform = `rotate(${frame.rotation}deg)`;
}

function snap(value, distance = 8) {
  const snapped = Math.round(value / 10) * 10;
  return Math.abs(snapped - value) <= distance ? snapped : value;
}

function axisSnap(start, size, targets, distance = 8) {
  const anchors = [start, start + size / 2, start + size];
  let match = null;
  anchors.forEach(anchor => {
    targets.forEach(target => {
      const delta = target - anchor;
      if (Math.abs(delta) <= distance && (!match || Math.abs(delta) < Math.abs(match.delta))) {
        match = { delta, target };
      }
    });
  });
  return match;
}

function selectionIds(osState, elementId, append) {
  const current = Array.isArray(osState.widgetEditorElementIds)
    ? osState.widgetEditorElementIds
    : [];
  if (append) {
    return current.includes(elementId)
      ? current.filter(id => id !== elementId)
      : [...current, elementId];
  }
  return current.includes(elementId) ? current : [elementId];
}

export function bindCompositionWidgetEditor(container, osState, handlers = {}) {
  if (!osState.widgetEditing) return;

  container.querySelectorAll('[data-composition-widget]').forEach(widgetNode => {
    const widgetId = widgetNode.dataset.compositionWidget;
    const canvas = widgetNode.querySelector('.composition-canvas');
    if (!canvas) return;

    widgetNode.addEventListener('pointerdown', event => {
      if (event.target.closest('.composition-widget-drag-handle')) return;
      const elementNode = event.target.closest('[data-composition-element]');
      if (!elementNode || !widgetNode.contains(elementNode)) {
        handlers.selectCompositionElements?.(widgetId, []);
        return;
      }
      if (elementNode.dataset.compositionLocked === 'true') {
        handlers.selectCompositionElements?.(widgetId, [elementNode.dataset.compositionElement]);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const elementId = elementNode.dataset.compositionElement;
      const parentId = elementNode.dataset.compositionParent;
      const groupedIds = parentId
        ? [...widgetNode.querySelectorAll(`[data-composition-parent="${CSS.escape(parentId)}"]`)].map(node => node.dataset.compositionElement)
        : [];
      const ids = !event.shiftKey && groupedIds.length
        ? groupedIds
        : selectionIds(osState, elementId, event.shiftKey);
      if (!ids.length) return;
      handlers.selectCompositionElements?.(widgetId, ids, { noPhoneRender: true });

      const nodes = ids.map(id => widgetNode.querySelector(`[data-composition-element="${CSS.escape(id)}"]`)).filter(Boolean);
      nodes.forEach(node => node.classList.add('is-selected'));
      const initial = new Map(nodes.map(node => [node.dataset.compositionElement, frameFromNode(node)]));
      const bounds = canvas.getBoundingClientRect();
      const scaleX = 1000 / Math.max(1, bounds.width);
      const scaleY = 1000 / Math.max(1, bounds.height);
      const start = { x: event.clientX, y: event.clientY };
      const mode = event.target.closest('[data-composition-rotate]')
        ? 'rotate'
        : event.target.closest('[data-composition-resize]') ? 'resize' : 'move';
      const frames = [...initial.values()];
      const groupBounds = {
        x: Math.min(...frames.map(frame => frame.x)),
        y: Math.min(...frames.map(frame => frame.y)),
        right: Math.max(...frames.map(frame => frame.x + frame.w)),
        bottom: Math.max(...frames.map(frame => frame.y + frame.h))
      };
      groupBounds.w = groupBounds.right - groupBounds.x;
      groupBounds.h = groupBounds.bottom - groupBounds.y;
      const otherFrames = [...widgetNode.querySelectorAll('[data-composition-element]')]
        .filter(node => !ids.includes(node.dataset.compositionElement) && node.dataset.compositionType !== 'group')
        .map(frameFromNode);
      const horizontalTargets = [0, 500, 1000];
      const verticalTargets = [0, 500, 1000];
      otherFrames.forEach(frame => {
        horizontalTargets.push(frame.x, frame.x + frame.w / 2, frame.x + frame.w);
        verticalTargets.push(frame.y, frame.y + frame.h / 2, frame.y + frame.h);
      });
      const center = nodes.length > 1 ? {
        x: bounds.left + (groupBounds.x + groupBounds.w / 2) / scaleX,
        y: bounds.top + (groupBounds.y + groupBounds.h / 2) / scaleY
      } : {
        x: elementNode.getBoundingClientRect().left + elementNode.getBoundingClientRect().width / 2,
        y: elementNode.getBoundingClientRect().top + elementNode.getBoundingClientRect().height / 2
      };
      const startAngle = Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180 / Math.PI;
      const guideX = document.createElement('i');
      const guideY = document.createElement('i');
      guideX.className = 'composition-snap-guide is-x';
      guideY.className = 'composition-snap-guide is-y';
      guideX.hidden = true;
      guideY.hidden = true;
      canvas.append(guideX, guideY);

      const move = moveEvent => {
        const dx = (moveEvent.clientX - start.x) * scaleX;
        const dy = (moveEvent.clientY - start.y) * scaleY;
        const movingX = clamp(groupBounds.x + dx, -groupBounds.w + 20, 980);
        const movingY = clamp(groupBounds.y + dy, -groupBounds.h + 20, 980);
        const snapX = mode === 'move' ? axisSnap(movingX, groupBounds.w, horizontalTargets) : null;
        const snapY = mode === 'move' ? axisSnap(movingY, groupBounds.h, verticalTargets) : null;
        const resolvedDx = movingX + (snapX?.delta || 0) - groupBounds.x;
        const resolvedDy = movingY + (snapY?.delta || 0) - groupBounds.y;
        nodes.forEach(node => {
          const base = initial.get(node.dataset.compositionElement);
          const next = { ...base };
          if (mode === 'move') {
            next.x = snap(base.x + resolvedDx);
            next.y = snap(base.y + resolvedDy);
          } else if (mode === 'resize' && nodes.length > 1) {
            const factorX = Math.max(20, groupBounds.w + dx) / Math.max(20, groupBounds.w);
            const factorY = Math.max(20, groupBounds.h + dy) / Math.max(20, groupBounds.h);
            next.x = groupBounds.x + (base.x - groupBounds.x) * factorX;
            next.y = groupBounds.y + (base.y - groupBounds.y) * factorY;
            next.w = Math.max(20, base.w * factorX);
            next.h = Math.max(20, base.h * factorY);
          } else if (mode === 'resize' && node === elementNode) {
            next.w = snap(clamp(base.w + dx, 20, 2000));
            next.h = snap(clamp(base.h + dy, 20, 2000));
          } else if (mode === 'rotate') {
            const angle = Math.atan2(moveEvent.clientY - center.y, moveEvent.clientX - center.x) * 180 / Math.PI;
            const delta = Math.round((angle - startAngle) / 5) * 5;
            next.rotation = base.rotation + delta;
            if (nodes.length > 1) {
              const centerX = base.x + base.w / 2;
              const centerY = base.y + base.h / 2;
              const radians = delta * Math.PI / 180;
              const originX = groupBounds.x + groupBounds.w / 2;
              const originY = groupBounds.y + groupBounds.h / 2;
              const rotatedX = originX + (centerX - originX) * Math.cos(radians) - (centerY - originY) * Math.sin(radians);
              const rotatedY = originY + (centerX - originX) * Math.sin(radians) + (centerY - originY) * Math.cos(radians);
              next.x = rotatedX - base.w / 2;
              next.y = rotatedY - base.h / 2;
            }
          }
          applyFrame(node, next);
          node.dataset.previewFrame = JSON.stringify(next);
        });
        if (mode === 'move') {
          guideX.hidden = !snapX;
          guideY.hidden = !snapY;
          if (snapX) guideX.style.left = `${snapX.target / 10}%`;
          if (snapY) guideY.style.top = `${snapY.target / 10}%`;
        }
      };

      const finish = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        guideX.remove();
        guideY.remove();
        const updates = nodes.map(node => ({
          id: node.dataset.compositionElement,
          frame: node.dataset.previewFrame ? JSON.parse(node.dataset.previewFrame) : initial.get(node.dataset.compositionElement)
        }));
        handlers.commitCompositionFrames?.(widgetId, updates);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish, { once: true });
      window.addEventListener('pointercancel', finish, { once: true });
    });
  });
}
