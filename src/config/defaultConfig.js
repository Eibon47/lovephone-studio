import { cloneCustomization, DEFAULT_CUSTOMIZATION } from '../services/customizationModel.js?v=app-config-104';

export const defaultConfig = {
  version: 6,
  meta: {
    title: '我的小手机',
    templateId: 'minimal-phone',
    appFlowVersion: 5,
    createdAt: '',
    updatedAt: '',
    phoneSetup: {
      dismissed: false,
      completed: {
        character: false,
        ai: false,
        backup: false
      }
    }
  },
  character: {
    id: 'character-main',
    name: '小满',
    userName: '我',
    relationship: '陪伴者',
    aiProviderId: '',
    aiProfiles: {},
    personality: ['温柔', '会主动关心'],
    speakingStyle: '轻声、自然、像熟人聊天',
    greeting: '你回来啦，今天过得怎么样？',
    definition: '一个会稳定陪伴用户的小手机角色，语气自然、有边界感，会记住重要的小事，也会主动关心用户的状态。',
    avatar: {
      type: 'preset',
      value: 'heart'
    }
  },
  characters: [],
  customApps: [],
  theme: {
    id: 'basic',
    fontStyle: 'wenkai',
    primaryColor: '#7fb59a',
    phoneFrame: 'dark',
    iconSet: 'soft',
    widgetStyle: 'colorful',
    widgets: {
      clock: {
        enabled: true,
        title: '\u4eca\u65e5',
        subtitle: '\u4fdd\u6301\u4e00\u70b9\u70b9\u9760\u8fd1',
        layout: { x: 0, y: 0, w: 4, h: 2 }
      },
      vinyl: {
        enabled: false,
        title: '\u5531\u7247\u673a',
        image: '',
        layout: { x: 0, y: 2, w: 2, h: 2 }
      },
      photo: {
        enabled: false,
        title: '\u76f8\u6846',
        image: '',
        layout: { x: 2, y: 2, w: 2, h: 2 }
      },
      weather: {
        enabled: false,
        city: '上海',
        latitude: 31.2304,
        longitude: 121.4737,
        temperature: '24°',
        condition: '晴间多云',
        layout: { x: 0, y: 2, w: 2, h: 2 }
      },
      calendar: {
        enabled: false,
        title: '七月',
        layout: { x: 2, y: 2, w: 2, h: 2 }
      },
      anniversary: {
        enabled: false,
        title: '我们认识',
        days: 365,
        layout: { x: 0, y: 4, w: 2, h: 2 }
      },
      characterStatus: {
        enabled: false,
        status: '正在想你',
        layout: { x: 0, y: 4, w: 4, h: 2 }
      },
      mood: {
        enabled: false,
        title: '这周心情',
        layout: { x: 0, y: 6, w: 2, h: 2 }
      },
      quickActions: {
        enabled: false,
        title: '快捷互动',
        layout: { x: 2, y: 6, w: 2, h: 2 }
      }
    },
    appLayouts: {},
    appLooks: {},
    customization: cloneCustomization(DEFAULT_CUSTOMIZATION)
  },
  components: {
    chat: true,
    music: true,
    memory: false,
    diary: false,
    anniversary: false,
    goodnight: false
  },
  apps: {
    character: {
      enabled: true,
      required: true,
      activeCharacterId: 'character-main',
      allowMultiple: true,
      maxCharacters: 3,
      avatar: true,
      profileCard: true,
      voice: false,
      statusBar: {
        enabled: true,
        items: ['mood', 'online', 'todayLine']
      },
      ai: {
        enabled: true,
        mode: 'global',
        providerId: 'global'
      }
    },
    chat: {
      enabled: true,
      required: true,
      ai: {
        enabled: true,
        mode: 'character',
        providerId: 'character'
      },
      history: true,
      timestamps: true,
      voiceButton: false,
      quickReplies: true,
      inputBox: true,
      layout: 'bubble',
      messages: [],
      sessions: [],
      activeSessionIds: {},
      // Drafts are scoped by session ID. They are content the user explicitly
      // typed, so keeping them makes a refresh or an accidental return safe.
      drafts: {}
    },
    music: {
      enabled: true,
      required: false,
      source: 'netease-compatible-api',
      apiBaseUrl: '',
      onlineEnabled: false,
      showRecommendations: true,
      showLyrics: true,
      autoplay: false
    },
    memory: {
      enabled: false,
      required: false,
      longTerm: false,
      localOnly: true,
      autoWrite: false,
      userEditable: true,
      visibleCards: true,
      types: ['profile', 'preferences'],
      entries: []
    },
    diary: {
      enabled: false,
      required: false,
      dailyEntry: true,
      moodTags: true,
      aiSummary: false,
      characterComment: false,
      entries: []
    },
    anniversary: {
      enabled: false,
      required: false,
      multipleDates: true,
      countdown: true,
      desktopWidget: false,
      reminders: false,
      reminderDays: 3,
      sentReminders: [],
      events: []
    },
    goodnight: {
      enabled: false,
      required: false,
      goodMorning: false,
      goodNight: true,
      aiGenerated: false,
      desktopNote: true,
      notifications: false,
      useCurrentCharacter: true,
      entries: [],
      greetings: []
    },
    settings: {
      enabled: true,
      required: true,
      apiProfiles: true,
      perRoleApi: true,
      themeControls: true,
      exportImport: true
    }
  },
  aiProviders: {
    // Empty means automatic: local development uses the desktop bridge and a
    // deployed site uses the same-origin Netlify Function.
    bridgeUrl: '',
    pendingProfileDeletes: [],
    selected: ['deepseek', 'qwen', 'kimi', 'zhipu', 'openai', 'anthropic', 'gemini', 'custom'],
    activeId: 'deepseek',
    profiles: {
      deepseek: {
        model: 'deepseek-chat',
        baseUrl: ''
      }
    },
    global: {
      label: '全局默认 AI',
      provider: 'deepseek',
      apiKeyMode: 'user-provided',
      baseUrl: '',
      model: ''
    }
  },
  aiAssistant: {
    enabled: false,
    providerId: '',
    profileId: 'builder-assistant',
    model: '',
    baseUrl: '',
    designBrief: {
      preferences: [],
      avoid: [],
      decisions: [],
      updatedAt: ''
    }
  },
  companion: {
    events: [],
    timeline: [],
    memoryCandidates: [],
    followUps: [],
    tasks: [],
    notifications: [],
    relationshipSignals: {},
    proactive: {
      defaults: {
        enabled: true,
        quietHours: { enabled: true, start: '23:00', end: '08:00' },
        dailyLimit: 3,
        suppressWhileUnanswered: true,
        emotionFollowUp: true,
        emotionFollowUpMinutes: 30,
        morningGreeting: true,
        nightGreeting: true,
        diaryResponse: true,
        anniversaryReminder: true
      },
      characterOverrides: {}
    },
    integrations: {
      musicContext: false,
      diaryCompanion: false,
      anniversaryCompanion: false,
      moodAwareGreetings: false,
      relationshipDesktop: false
    }
  },
  model: {
    mode: 'not-configured',
    apiKeyMode: 'user-provided'
  },
  memory: {
    enabled: false,
    mode: 'local-basic'
  },
  voice: {
    enabled: false
  }
};

export function cloneConfig(config = defaultConfig) {
  return JSON.parse(JSON.stringify(config));
}
