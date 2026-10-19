# Getting Nova on Android (all free)

There are three free routes. Pick whichever suits you.

## 1. Install the PWA (easiest, no APK)
Open your deployed site (e.g. `https://<you>.github.io/<repo>/`) in **Chrome** on Android → menu **⋮ → Install app / Add to Home screen**. Nova then runs full-screen, works offline, and updates itself.

## 2. Build the APK with GitHub Actions (recommended for an APK)
No Android Studio or local setup needed.
1. Push this repo to GitHub.
2. Go to **Actions → Build Android APK → Run workflow**.
3. When it finishes, open the run and download the **Nova-APK** artifact (`Nova.apk`).
4. Copy it to your phone, open it, and allow "Install unknown apps" for your file manager/browser.

Tag a release (`git tag v1.0.0 && git push --tags`) and the APK is attached to a GitHub Release automatically — a public download link for your users.

> The workflow produces a **debug-signed** APK, which installs fine for sideloading and sharing. Google Play requires a release-signed bundle; see "Signing" below.

## 3. Build locally
Requirements: Node 20+, JDK 21, Android Studio (or the Android SDK command-line tools).
```bash
npm install
npm run build
npx cap add android          # first time only
npx cap sync android
npx cap open android         # then Build → Build APK(s) in Android Studio
# or: cd android && ./gradlew assembleDebug   → android/app/build/outputs/apk/debug/app-debug.apk
```

## Signing a release build (optional)
Generate a keystore once (`keytool -genkey -v -keystore nova.jks -alias nova -keyalg RSA -keysize 2048 -validity 10000`), keep it **private and backed up**, then follow Android Studio's *Build → Generate Signed Bundle / APK*. Never commit the keystore (it is in `.gitignore`).

## Check live web on your phone (3 steps)
I could only test this with a simulated Android environment, so please confirm once on a real device:
1. Install the APK, open **Settings → Sources** — you should see **“Android app: on”** next to *Live web*.
2. Ask: *“How was the Moon formed? show me a video”*. The status should say *Searching the web…* then *Reading pages…*; the answer should show a **Sources** pill with real websites and a **Videos** row.
3. If it only shows Wikipedia-type sources, connect the phone by USB, open `chrome://inspect` on your PC and look at the console for blocked requests; adding a free **Brave** or **Tavily** key (Settings → Sources) makes search independent of HTML scraping.

## What works inside the Android app
| Feature | Android app | Notes |
|---|---|---|
| Chat, sources, calculator, weather, history | ✅ | |
| Live web search + reading pages, YouTube cards | ✅ | native HTTP, no CORS limits |
| Free API keys (Gemini/Groq/OpenRouter) | ✅ | best answer quality |
| Free online AI / custom endpoint | ✅ | needs internet |
| On-device AI (WebLLM) | ⚠️ device-dependent | Needs WebGPU in the Android System WebView; only recent devices/WebView versions have it. Otherwise use the PWA in Chrome, or the online/custom modes. |
| Voice typing | ⚠️ | Browser speech recognition is often unavailable in WebViews; use your keyboard's microphone key. |
| Read aloud | ✅ | uses the device's text-to-speech |

## Alternative: PWABuilder
[pwabuilder.com](https://www.pwabuilder.com) can package your *deployed* PWA URL into an Android package for free.


## Home-screen widget
After installing the APK: long-press an empty spot on the home screen → **Widgets** → **Nova**. Tap the bar to open Nova, tap the microphone to speak a question. (The widget is added to the Android project by `scripts/android-patch.mjs`, which the GitHub workflow runs for you.)
