function cleanProfileId(value) {
  const profileId = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{2,120}$/.test(profileId) ? profileId : '';
}

export function enqueueAiProfileDelete(config, profileId) {
  const cleaned = cleanProfileId(profileId);
  if (!cleaned) return config;
  const pendingProfileDeletes = [...new Set([
    ...(config.aiProviders?.pendingProfileDeletes || []),
    cleaned
  ])];
  return {
    ...config,
    aiProviders: {
      ...config.aiProviders,
      pendingProfileDeletes
    }
  };
}

export async function flushAiProfileDeletes(config, removeProfile) {
  const pending = [...new Set(
    (config.aiProviders?.pendingProfileDeletes || [])
      .map(cleanProfileId)
      .filter(Boolean)
  )];
  const remaining = [];
  for (const profileId of pending) {
    try {
      await removeProfile(profileId);
    } catch {
      remaining.push(profileId);
    }
  }
  return {
    ...config,
    aiProviders: {
      ...config.aiProviders,
      pendingProfileDeletes: remaining
    }
  };
}
