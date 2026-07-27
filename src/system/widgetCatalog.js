export const WIDGET_CATALOG = [
  {
    id: 'clock',
    name: '时间与日期',
    desc: '大号时间、日期和今日短句。',
    size: '横向',
    tone: 'mint'
  },
  {
    id: 'weather',
    name: '今日天气',
    desc: '温度、天气状态和高低温。',
    size: '方形',
    tone: 'sky'
  },
  {
    id: 'vinyl',
    name: '正在播放',
    desc: '唱片封面、歌曲信息和播放控制。',
    size: '方形',
    tone: 'night',
    imagePath: 'theme.widgets.vinyl.image'
  },
  {
    id: 'photo',
    name: '照片回忆',
    desc: '用一张照片装点桌面。',
    size: '方形',
    tone: 'photo',
    imagePath: 'theme.widgets.photo.image'
  },
  {
    id: 'calendar',
    name: '月历',
    desc: '显示当前日期和本月日历。',
    size: '方形',
    tone: 'paper'
  },
  {
    id: 'anniversary',
    name: '纪念日',
    desc: '记录在一起或相识的天数。',
    size: '方形',
    tone: 'rose'
  },
  {
    id: 'characterStatus',
    name: '角色状态',
    desc: '显示角色头像、心情和在线状态。',
    size: '横向',
    tone: 'lavender'
  },
  {
    id: 'dailyNote',
    name: '今日陪伴语',
    desc: '把角色的一句话留在桌面。',
    size: '横向',
    tone: 'cream'
  },
  {
    id: 'mood',
    name: '心情记录',
    desc: '一周心情趋势与今日状态。',
    size: '方形',
    tone: 'coral'
  },
  {
    id: 'quickActions',
    name: '快捷互动',
    desc: '聊天、语音、日记和戳一戳入口。',
    size: '方形',
    tone: 'green'
  }
];

export const WIDGET_IDS = WIDGET_CATALOG.map(widget => widget.id);
