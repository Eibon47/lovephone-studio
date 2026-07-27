# LovePhone Studio DIY MVP Design

## 1. Product Positioning

LovePhone Studio is a DIY tool for creating a personal AI companion phone. The first version is not a creator marketplace, template shop, or multi-user platform. It is a local-first builder that helps one user create, preview, save, and reopen their own small companion phone.

The core promise:

> A user who does not understand code, prompts, model setup, or UI configuration can create a personal AI companion phone in a few minutes.

The product should feel like building a tiny phone, not filling out an admin form. The builder should use friendly choices, visual previews, presets, and short inputs. Advanced model, voice, and memory settings can exist later, but the first version should keep them behind simple toggles.

## 2. Reference Demo Assessment

Reference path:

`E:\Desktop\[existing LovePhone demo]\01_[phone app]\[published build]\publish\love-phone-web`

The existing demo is best understood as a LovePhone runtime prototype. It already proves that the phone form works visually and emotionally. It includes a phone shell, dynamic island, splash screen, lock screen, desktop, dock, app icons, chat page, character page, memory page, diary, timeline, relationship archive, schedule, settings, themes, wallpapers, local storage, client-side chat API settings, and voice settings.

The most valuable reusable parts are:

- Phone shell and responsive phone frame
- Lock screen and home screen visual structure
- Fantasy theme assets under `assets/theme-fantasy`
- App registry concept
- Desktop app icon and dock layout
- Chat page layout
- Local-first storage direction
- User-provided API key direction

The parts that should not be copied as-is into the first builder:

- Large single-file `script.js` structure
- Internal settings-first workflow
- Too many runtime apps exposed at once
- Full chat, memory, schedule, relationship, diary, timeline logic before the builder loop is proven
- Complex desktop editing and drag behavior

The builder should reuse the demo's form language and visual identity, but reorganize it around a single configuration object.

## 3. MVP Scope

The first version should be a single-page builder with four steps:

1. Character
2. Appearance
3. Components
4. Preview and Save

The screen layout:

- Left side: builder controls
- Right side: live phone preview
- Top: product name and step navigation
- Bottom or header action area: save, reset, export JSON, import JSON

Required MVP features:

- Character name
- User nickname or how the character calls the user
- Relationship type
- Personality tags
- Speaking style
- Theme selection
- Wallpaper selection
- Font style selection
- Phone frame style
- Component toggles
- Live preview
- Save configuration to local storage
- Export configuration JSON
- Import configuration JSON
- Reset to default configuration

Component toggles for MVP:

- Chat
- Memory
- Diary
- Anniversary or timeline
- Goodnight greeting

Explicitly out of scope for MVP:

- Account system
- Cloud sync
- Template marketplace
- Payment
- Public sharing
- Creator profile pages
- Complex drag and drop layout
- Full desktop icon free placement
- Multiple model providers UI
- Full long-term memory engine
- Voice generation
- Speech recognition
- Moderation workflow

## 4. Configuration Model

The builder should treat configuration as the product's source of truth. The preview should render from this config, and future runtime versions should also be able to load the same config.

Initial schema:

```json
{
  "version": 1,
  "meta": {
    "title": "My LovePhone",
    "createdAt": "",
    "updatedAt": ""
  },
  "character": {
    "name": "Sweetheart",
    "userName": "Me",
    "relationship": "partner",
    "personality": ["gentle", "clingy"],
    "speakingStyle": "soft, caring, occasionally playful",
    "greeting": "You are back. How was your day?",
    "avatar": {
      "type": "preset",
      "value": "heart"
    }
  },
  "theme": {
    "id": "fantasy",
    "wallpaper": "sage-parchment",
    "fontStyle": "system",
    "primaryColor": "#7FB59A",
    "phoneFrame": "dark"
  },
  "components": {
    "chat": true,
    "memory": true,
    "diary": true,
    "anniversary": true,
    "goodnight": true
  },
  "model": {
    "mode": "not-configured",
    "apiKeyMode": "user-provided"
  },
  "memory": {
    "enabled": true,
    "mode": "local-basic"
  },
  "voice": {
    "enabled": false
  }
}
```

The MVP should keep this schema small and stable. If a field does not affect the first preview or saved output, it should not be added yet.

## 5. UI and Interaction Design

The phone preview is the emotional center of the product. The first screen should show the actual builder and phone preview, not a marketing landing page.

Recommended layout:

- Left panel width around 360 to 440 px on desktop
- Right preview area centered, showing a phone similar to the old demo
- Mobile layout stacks controls above preview or uses tabs between "edit" and "preview"
- Step navigation uses concise labels: Character, Appearance, Components, Preview

Character step:

- Short text inputs for name and user name
- Relationship segmented choices: Partner, Friend, Companion, Family, Custom
- Personality tag chips
- Speaking style preset chips plus optional textarea
- Greeting textarea

Appearance step:

- Theme cards with visual swatches
- Wallpaper thumbnails
- Font style segmented control
- Phone frame swatches
- Primary color swatches

Components step:

- Toggle rows with small icons
- Each component row says what appears in the preview, not technical details
- No complex placement controls in MVP

Preview step:

- Show saved config status
- Export JSON
- Import JSON
- Reset
- Optional "open generated phone" button later

## 6. Preview Runtime

The first preview runtime should be intentionally simpler than the old demo. It should render:

- Phone frame
- Status bar
- Home screen wallpaper
- Desktop widget or note
- App icons based on enabled components
- Dock with key apps
- Simple chat preview using character name and greeting

Preview state should be derived from config only. Avoid duplicating independent state inside the preview. If the user changes `character.name`, all preview locations should update from the same source.

Suggested render mapping:

- `character.name` updates splash, lock card, chat header, app subtitles
- `character.greeting` updates chat preview first message
- `theme.wallpaper` updates home and chat backgrounds
- `theme.fontStyle` updates preview font class
- `components.chat` controls Chat icon and dock entry
- `components.memory` controls Memory icon and status text
- `components.diary` controls Diary icon
- `components.anniversary` controls Timeline icon
- `components.goodnight` controls a small note/widget line

The preview does not need real navigation in the first cut, but clicking Chat to switch the preview to chat mode would make the demo feel much more alive.

## 7. Technical Architecture

Recommended first implementation:

- Static web app
- Plain HTML/CSS/JS or a lightweight Vite app
- No backend
- Local storage persistence
- JSON import/export
- Assets copied from the old fantasy theme into the new project

Suggested file structure:

```text
src/
  main.js
  config/
    defaultConfig.js
    schema.js
  builder/
    BuilderApp.js
    CharacterPanel.js
    AppearancePanel.js
    ComponentsPanel.js
    PreviewActions.js
  preview/
    PhonePreview.js
    HomePreview.js
    ChatPreview.js
    previewMapping.js
  storage/
    localConfigStore.js
  styles/
    base.css
    builder.css
    phone-preview.css
  assets/
    theme-fantasy/
```

If the project stays framework-free, the same structure can be mirrored with plain modules and DOM rendering functions.

Core modules:

- `defaultConfig`: defines the initial phone configuration
- `configStore`: save, load, import, export, reset
- `builderState`: current config and update functions
- `previewMapping`: converts config into preview display data
- `PhonePreview`: renders the right-side phone
- `BuilderControls`: renders the left-side controls

## 8. Data Flow

The data flow should stay one-way:

```text
User input
  -> update config
  -> validate/normalize config
  -> save draft locally
  -> render builder controls
  -> render phone preview
```

Do not let the preview directly mutate unrelated state. If a preview click changes mode, keep it as UI-only preview state, separate from saved phone configuration.

Persistence keys:

- `lovePhoneStudioConfig`
- `lovePhoneStudioLastExportName`

The old runtime used many `lovePhone*` local storage keys. The builder should use its own keys to avoid clashing with the old demo.

## 9. Migration From Demo

Migration should be selective.

Copy or adapt:

- Phone frame CSS
- Status bar CSS
- Home screen layout idea
- Chat preview layout
- Fantasy theme image assets
- App icon assets
- Theme color variables

Rewrite:

- Builder UI
- Config schema
- Save/import/export logic
- Preview render functions
- Component toggle mapping

Defer:

- Real AI chat
- TTS/ASR
- Relationship growth
- Schedule generation
- AI memory extraction
- Full desktop icon editing
- IndexedDB mirror

The old demo can remain as a reference artifact. The new builder should not depend on the old single-file runtime directly.

## 10. Testing and Verification

MVP verification checklist:

- Default config renders without errors
- Editing character name updates all preview locations
- Editing greeting updates chat preview
- Changing theme updates preview styling
- Toggling components adds/removes icons
- Save persists after page reload
- Reset restores default config
- Export downloads valid JSON
- Import accepts valid JSON and rejects invalid JSON gracefully
- Preview fits desktop and mobile widths
- No text overlaps inside buttons, cards, or the phone preview

Manual visual checks:

- Desktop viewport around 1440 x 900
- Laptop viewport around 1280 x 720
- Mobile viewport around 390 x 844

## 11. Build Order

Recommended implementation order:

1. Create static app skeleton
2. Add default config and local storage
3. Build phone preview shell
4. Add fantasy theme assets and basic theme styling
5. Build character controls
6. Build appearance controls
7. Build component toggles
8. Add import/export/reset
9. Add responsive layout polish
10. Run visual verification

The first usable demo is complete when a user can open the page, fill in a role, choose a look, toggle components, see the phone change, and save/export the result.
