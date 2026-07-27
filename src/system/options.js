export const fontStyles = [
  { id: 'wenkai', label: '手账感' },
  { id: 'clean', label: '清爽' },
  { id: 'serif', label: '故事感' }
];

export const phoneFrames = [
  { id: 'dark', label: '深黑' },
  { id: 'graphite', label: '石墨' },
  { id: 'cream', label: '奶油' },
  { id: 'midnight', label: '午夜' }
];

export const appOptions = [
  {
    key: 'character',
    name: '角色',
    desc: '管理角色列表、角色设定、状态栏和角色自己的 AI 接入方式。',
    icon: 'character',
    required: true
  },
  {
    key: 'chat',
    name: '聊天',
    desc: '让角色真正能陪你说话，是陪伴手机的核心入口。',
    icon: 'chat',
    required: true
  },
  {
    key: 'memory',
    name: '记忆',
    desc: '让小手机有“会记得你”的陪伴感，后续可接长期记忆。',
    icon: 'memory'
  },
  {
    key: 'music',
    name: '音乐',
    desc: '搜索歌曲、播放音乐，并把正在播放同步到桌面组件。',
    icon: 'music'
  },
  {
    key: 'diary',
    name: '日记',
    desc: '记录今天的小事和情绪，适合偏手账的陪伴手机。',
    icon: 'diary'
  },
  {
    key: 'anniversary',
    name: '纪念日',
    desc: '保存重要日子、关系节点和时间线入口。',
    icon: 'anniversary'
  },
  {
    key: 'goodnight',
    name: '晚安问候',
    desc: '桌面显示晚安、早安或想念你的短句。',
    icon: 'goodnight'
  },
  {
    key: 'settings',
    name: '设置',
    desc: '调整字体、手机壳和主色，是系统必带 App。',
    icon: 'settings',
    required: true
  }
];

export const companionOptions = appOptions.filter(option => !option.required);
