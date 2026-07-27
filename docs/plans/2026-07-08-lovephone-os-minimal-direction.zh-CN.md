# LovePhone OS 极简版方向

## 1. 核心判断

LovePhone Studio 不应该只被理解成“一个配置页面 + 一个手机预览”。

更准确的方向是：

> 一个运行在网页里的极简手机系统，用来承载 AI 角色陪伴。

它不是要做真正的 Android，也不是要做完整操作系统。它只需要做类似 Firefox OS / Gaia 的上层体验：

- 状态栏
- 锁屏
- 桌面
- Dock
- App 图标
- App 页面切换
- 设置
- 本地配置
- 通知 / 小组件

也就是说，第一版要做的是：

> LovePhone OS = 手机壳系统 + 角色陪伴 App。

## 2. 参考 Gaia，但只取最小模型

Firefox OS / Gaia 的启发是：

> 手机系统的 UI 层可以完全用 HTML / CSS / JS 实现。

但 Gaia 太大，不适合直接照搬。我们只借它的结构思想：

```text
SystemShell
  StatusBar
  LockScreen
  HomeScreen
  Dock
  AppRouter

Apps
  CharacterApp
  ChatApp
  MemoryApp
  DiaryApp
  AnniversaryApp
  SettingsApp

System
  appRegistry
  configStore
  themeStore
  notificationStore
```

第一版只实现其中最小的一部分：

```text
LovePhoneOS
  StatusBar
  HomeScreen
  Dock
  AppRouter
  appRegistry
  configStore

Apps
  CharacterApp
  ChatApp
  SettingsApp
```

## 3. 第一版产品形态

打开页面后，用户看到的应该不是“表单工具”，而是一个小手机系统。

左侧可以仍然保留搭建器控制区，但它不应该承担全部配置。它只负责：

- 选择模板
- 选择基础外观
- 选择启用哪些 App
- 保存 / 导入 / 导出

真正属于小手机内部的东西，应该放进小手机自己的 App 里：

- 角色资料 -> CharacterApp
- 聊天 -> ChatApp
- 外观设置 -> SettingsApp
- 记忆 -> MemoryApp
- 日记 -> DiaryApp
- 纪念日 -> AnniversaryApp

这样用户会觉得自己是在使用一个“小手机系统”，而不是在旁边配置一个展示模型。

## 4. 极简 App Registry

不要把 App 图标和页面写死在预览里。应该有一个注册表：

```js
const APP_REGISTRY = [
  {
    id: 'character',
    name: '角色',
    icon: 'character',
    enabled: true,
    dock: false,
    component: CharacterApp
  },
  {
    id: 'chat',
    name: '聊天',
    icon: 'chat',
    enabledBy: 'components.chat',
    dock: true,
    component: ChatApp
  },
  {
    id: 'settings',
    name: '设置',
    icon: 'settings',
    enabled: true,
    dock: true,
    component: SettingsApp
  }
];
```

桌面只做一件事：

> 读取 APP_REGISTRY，然后渲染启用的 App。

AppRouter 只做一件事：

> 根据当前 appId 渲染对应 App 页面。

这样以后新增“日记”“记忆”“纪念日”，不是改一堆桌面逻辑，而是新增一个 App 模块并注册。

## 5. 推荐目录结构

下一步代码可以往这个结构演进：

```text
src/
  main.js

  system/
    LovePhoneOS.js
    StatusBar.js
    HomeScreen.js
    Dock.js
    AppRouter.js
    appRegistry.js

  apps/
    CharacterApp.js
    ChatApp.js
    SettingsApp.js
    MemoryApp.js
    DiaryApp.js
    AnniversaryApp.js

  config/
    defaultConfig.js
    templates.js
    schema.js

  storage/
    localConfigStore.js

  builder/
    BuilderApp.js
    TemplatePanel.js
    AppearancePanel.js
    CompanionPanel.js
    PreviewActions.js

  styles/
    base.css
    builder.css
    phone-system.css
```

当前代码已经按这个方向把原来的 `PhonePreview.js` 拆成：

- `LovePhoneOS.js`
- `HomeScreen.js`
- `AppRouter.js`
- `apps/CharacterApp.js`
- `apps/ChatApp.js`

## 6. MVP 内部规则

为了保持极简，第一版 LovePhone OS 应该遵守这些规则：

1. 桌面只负责显示 App，不负责具体业务。
2. App 页面只通过统一入口打开，不互相直接调用。
3. 所有配置统一走 `configStore`。
4. App 是否显示，由 `appRegistry` 和 config 决定。
5. 手机内部状态只保留 `currentApp`，不要搞复杂路由。
6. 第一版不做多任务，不做窗口，不做后台，不做权限系统。
7. 第一版不做真正安装 App，只做“启用 / 关闭 App”。

## 7. 第一版应有的系统体验

最小系统体验：

- 桌面显示 App 图标
- 点击 App 进入 App 页面
- App 页面有返回桌面按钮
- Dock 显示常用 App
- 角色资料在 CharacterApp 里编辑
- 聊天预览在 ChatApp 里显示
- 设置 App 管基础外观
- 左侧搭建器只做系统外部配置

这会让产品气质从：

> 网页配置器

变成：

> 一个可以被搭建出来的小手机系统。

## 8. 已完成的重构结果

当前代码已经完成这轮极简 OS 化：

1. 原 `PhonePreview.js` 已拆成 `system/LovePhoneOS.js`。
2. 已新增 `system/appRegistry.js`。
3. 已新增 `system/HomeScreen.js`。
4. 已新增 `system/AppRouter.js`。
5. 角色页已拆成 `apps/CharacterApp.js`。
6. 聊天页已拆成 `apps/ChatApp.js`。
7. 已新增 `apps/SettingsApp.js`。
8. 桌面已经根据 `APP_REGISTRY` 渲染 App 图标。
9. Dock 已经根据 `APP_REGISTRY` 渲染常用入口。
10. 暂未重做视觉，只调整了内部结构。

下一步建议：

- 把 Memory / Diary / Anniversary 从占位 App 补成真实 App。
- 增加基础通知中心。
- 增加锁屏页。
- 把左侧搭建器逐步降级为“系统外部控制台”，让更多配置进入小手机内部 App。

## 9. 这个方向的关键价值

这样改之后，后面功能会变得很顺：

- 加“日记”就是新增 DiaryApp。
- 加“记忆”就是新增 MemoryApp。
- 加“纪念日”就是新增 AnniversaryApp。
- 加“设置”就是扩展 SettingsApp。
- 加“主题”不是改桌面，而是改 themeStore。
- 加“通知”不是散落到每个页面，而是加 notificationStore。

最终目标：

> 用户不是在搭一个页面，而是在搭一个属于自己的 AI 小手机系统。
