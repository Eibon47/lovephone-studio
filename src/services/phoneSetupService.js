const setupKeys = ['character', 'ai', 'backup'];

function bool(value) {
  return Boolean(value);
}

export function normalizePhoneSetup(source = {}) {
  const completed = source?.completed && typeof source.completed === 'object'
    ? source.completed
    : {};

  return {
    dismissed: bool(source?.dismissed),
    completed: Object.fromEntries(setupKeys.map(key => [key, bool(completed[key])]))
  };
}

export function phoneSetupProgress(config, osState = {}) {
  const setup = normalizePhoneSetup(config?.meta?.phoneSetup);
  const connectedAi = Object.values(osState.aiProviderStatuses || {})
    .some(status => status?.configured)
    || Object.values(osState.aiProfileStatuses || {})
      .some(status => status?.configured);
  const backupCreated = Number(osState.storageStatus?.backupCount) > 0;
  const completed = {
    character: setup.completed.character,
    ai: setup.completed.ai || connectedAi,
    backup: setup.completed.backup || backupCreated
  };

  return {
    dismissed: setup.dismissed,
    completed,
    completedCount: setupKeys.filter(key => completed[key]).length,
    isComplete: setupKeys.every(key => completed[key])
  };
}

export function shouldShowPhoneSetup(config, osState = {}) {
  const progress = phoneSetupProgress(config, osState);
  return !progress.dismissed && !progress.isComplete;
}
