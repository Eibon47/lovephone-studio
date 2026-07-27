export function removeItemWithUndo(items, id) {
  const index = items.findIndex(item => item.id === id);
  if (index < 0) return { next: items, undo: null };
  return {
    next: items.filter(item => item.id !== id),
    undo: {
      item: items[index],
      index
    }
  };
}

export function restoreItemFromUndo(items, undo) {
  if (!undo?.item || items.some(item => item.id === undo.item.id)) return items;
  const next = [...items];
  const index = Math.max(0, Math.min(Number(undo.index) || 0, next.length));
  next.splice(index, 0, undo.item);
  return next;
}
