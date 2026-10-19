# Changelog

## 1.5.4
- Removed like/dislike buttons and the engine label under answers.
- Profile: initials avatar (two letters for two names, one for a single name); tap it in Settings to edit name and photo in a sheet (Save profile / Cancel).

## 1.5.3
- Sidebar: no close (X) button; only a search button in the corner. Swipe the drawer left to close it. "+ Chat" button is flat (soft neutral shadow only).
- Answers: action row now has copy, like, dislike, listen, save, share; below it a "Sources" row with each website's own icon; tap opens the sources sheet.
- Long-press menu: four different icon colours.
- Settings: profile photo from the gallery (shown in the sidebar and Settings; can be removed).

## 1.5.2
- Default theme is now Black (new "Black" accent); dark mode uses ChatGPT-style greys instead of pure black.
- Six distinct light icon colours for the sidebar shortcuts.
- Chat long-press: "Add to library" (saves the chat as a library note) replaces "Add to project".

## 1.5.1
- Android: app now draws edge-to-edge (behind the status bar and navigation bar); read aloud uses the phone's own text-to-speech.
- Colourful icons are now plain glyphs (no circles).
- Sidebar: six shortcut tiles (New chat, Saved, Library, Briefing, Study, Tools) in 3 rows; new Tools page.
- Chats: long-press menu (Rename, Pin, Add to project, Delete); pinned chats on top.
- Sources: compact chip (stacked letters + count) opens the sheet; the sheet lifts to full height on swipe-up and scrolls smoothly.
- Removed "Continue exploring" suggestions; fixed broken Share menu; mic shows a clear "Listening…" state.

## 1.5.0
- Design kept as in 1.4 (reverted the flat/compact restyle).
- Full-screen pages instead of floating windows: source preview/reader, Saved answers, My library, web search (globe), welcome screen. Android back / browser back closes the top page.
- New full-screen image viewer: pinch, wheel and double-tap zoom, pan, swipe between images, back.
- Colourful PNG icon set (public/assets/cicons, regenerate with scripts/gen-icons.mjs) used in the sidebar, Settings, home cards and the "+" menu.
- Floating header: transparent bar, only the menu button and the private/new-chat pill float over the content.
- Sources open in a bottom sheet (half height; drag the handle up for full screen, down to close); tapping a source opens it full-screen.
- Sidebar shortcuts now sit two per row (New chat | Saved, My library | Briefing).

## 1.4.0
**Added**
- Settings is now a full page (like a phone's settings app): a menu of grouped cards with icons — Appearance, General, AI engine, Sources & live web, Search engine, Data & privacy, About.
- 10 light accent colours (Lavender, Sky, Aqua, Mint, Lemon, Peach, Coral, Rose, Orchid, Silver). One tap re-themes the whole app — buttons, menus, highlights and the Nova logo.
- Search engine switcher (Google, DuckDuckGo, Bing, Brave). The globe button in the chat bar opens a search sheet; results open in the built-in browser on Android (new tab on the web). The "Search on …" button under answers follows your choice.
- Private chat: the ghost button in the top bar opens a brand-new chat that is never saved, is hidden from history and disappears when you leave it.
- Saved answers can be organised into collections.
- Widgets: live cricket scores (Android app) and Panchang / tithi / nakshatra (computed on the device, works offline).
- New drawer (icon menu, profile pill, floating "+ Chat" button) and PNG section icons that follow the accent colour.

**Changed**
- Slim, floating chat bar: only as wide as it needs to be; answers stay visible beside and below it. Depth, answer style and knowledge-source switches moved into its "+" menu.
- Removed the "Nova can make mistakes" footer line.

## 1.3.1
**Added**
- Android home-screen widget: an "Ask Nova anything…" bar with a microphone button (tap the mic and Nova opens and starts listening). Added to the app automatically by `scripts/android-patch.mjs`; long-press the home screen → Widgets → Nova.
- Google Search grounding now pauses itself for an hour when the free Gemini quota is used up, tells you once, and answers with Nova's own web search instead of failing.

## 1.3.0
**Added**
- New logo (spiral mark) across the app, PWA icons, splash and Android launcher icon.
- Deep Research mode: splits a question into sub-questions, searches each, writes one long sourced report.
- Answer style: Short / Detailed / ELI5 / Hinglish.
- Voice input (native speech plugin on Android, Web Speech in browsers) and read-aloud.
- Hindi/Hinglish questions are searched in English, answered in the user's language.
- Source check badge (how many independent sites the answer cites) instead of a fake "agreement" score.
- Gemini "Grounding with Google Search" (optional, uses your free Gemini key) and a "Search on Google" in-app button.
- Retry with another engine, pin/save answers, share as text / picture card / PDF, private (unsaved) chats.
- Photo questions (Gemini vision or on-device OCR), PDF/file/link summaries, "My library" private notes and files, share-sheet intake.
- Study mode (quiz, flashcards, notes) and more widgets.

## 1.2.1
**Fixed**
- Full-sentence questions (e.g. "What were the main causes of the French revolution?") returned no Wikipedia results because MediaWiki search requires every word to match; Nova now searches with the content words.
- Image search used the whole sentence and returned unrelated pictures; it now uses the same content words.
- Clearer message when the keyless free online AI is down and no key is configured.

**Added**
- Dev-only proxy so live web search/reading can be tested on localhost with `npm run dev`.

## 1.2.0
**Added**
- Live web research in the Android app via native HTTP (no backend): multi-engine search, page reading, passage ranking, citations from real pages.
- YouTube video cards (playable in-app), page images, Bing "related searches" as follow-up suggestions.
- Free-key wizard (Gemini, Groq, OpenRouter, custom) with Test buttons and automatic provider fallback chain.
- Optional Brave Search and Tavily keys.

**Changed**
- Source labels show the real site (e.g. bbc.co.uk); follow-up chips are subject-aware.

## 1.1.0
**Added**
- 38 free databases (was 8) with per-question routing, per-database switches and response stats.
- Assistant-style behaviour: direct answers for chat/creative requests, identity answers, context-aware follow-ups, collapsed sources, "Gathering knowledge…" status.
- Restored from the original project: the full PNG icon pack and `nova-mark.png`, the four suggestion cards, topic labels, photosynthesis / plants / water-cycle visuals, in-app source reader, video suggestions.

**Fixed**
- v1.0 removed the original icon pack/logo; they are back (zip size matches the original again).

## 1.0.0
Rebuilt from the "Nova V11 Compact Black Composer" prototype.

**Added**
- Real generative answers: on-device (WebLLM), free online, custom OpenAI-compatible endpoint, with streaming, stop and regenerate.
- Retrieval-augmented prompts with numbered citations and clickable citation chips.
- More free sources: Open Library, Europe PMC, arXiv, Open-Meteo weather; Wikipedia in the user's language.
- Safe calculator, weather card, offline explainers, follow-up suggestions, read-aloud.
- Settings (theme, languages, AI engines, model manager, privacy), first-run onboarding, chat search, date-grouped history.
- PWA: real 192/512/maskable icons, build-time precache, update prompt, install button, offline banner.
- GitHub Actions for CI, Pages deploy and Android APK; Capacitor config; unit tests.

**Fixed**
- The 27-line minified `main.jsx` was split into readable modules.
- Manifest declared a 1254px image as 512px and had no maskable icon; the service worker cached a hard-coded shell and never precached build assets.
- Chats were saved to `localStorage` on every render; now debounced IndexedDB (legacy chats migrate automatically).
- The "reader" iframe could not display most sites and was a clickjacking/privacy risk; replaced by a safe preview with an "open original" action.
- Imported backups were not validated; they are now sanitised and de-duplicated.
- Streaming/in-flight answers no longer stay "loading" forever after a reload.
- The Hindi greeting "नमस्ते" was not recognised (Unicode word-boundary bug).
- Removed a Google Fonts `@import` (extra third-party request, blocked offline); system fonts are used.
- Removed 37 unused PNG icons and a 700 KB unused logo.
