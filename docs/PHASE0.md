# Phase 0: De-risk

Goal: prove that, from one laptop's Chrome, the same Firebase AI Logic hybrid model can run a prompt **on-device** (Gemini Nano) and **in the cloud**, with App Check enforced, and that the app can tell which one ran.

## How the source is detected

Firebase JS SDK `firebase@13.4.0` (`@firebase/ai@3.1.0`) is used. Hybrid inference needs v12.5.0 or newer.

- Mode: `getGenerativeModel(ai, { mode: InferenceMode.X, onDeviceParams })`, where `InferenceMode` is one of `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `ONLY_IN_CLOUD` or `PREFER_IN_CLOUD`.
- Source: `result.response.inferenceSource`, which is `InferenceSource.ON_DEVICE` (`"on_device"`) or `InferenceSource.IN_CLOUD` (`"in_cloud"`). The SDK provides it directly, so no workaround is needed. The docs show the values as `ON_DEVICE`/`IN_CLOUD`. The SDK constants are lowercase, and the spike compares against the enum, not string literals.
- Availability: the SDK has no public helper for this, so the spike calls Chrome's `LanguageModel.availability()` directly. It returns `available`, `downloadable`, `downloading` or `unavailable`. The spike adds `unsupported` for when `LanguageModel` is missing.
- Download: `model.initializeDeviceModel(onProgress)` starts the download. It must run from a user gesture.
- On-device limits: single-turn text, plus JPEG/PNG input. No chat, tools or grounding. Context is up to 9216 tokens. In `ONLY_ON_DEVICE` mode, unsupported requests throw.

## 1. Chrome setup for Gemini Nano

Checked against developer.chrome.com/docs/ai (get-started, prompt-api) and the Firebase hybrid docs, Nov 2026.

**Hardware**
- [ ] OS: macOS 13+ (Ventura or later), Windows 10/11, Linux, or ChromeOS on Chromebook Plus. Android and iOS are not supported.
- [ ] At least **22 GB free** on the volume holding your Chrome profile. If free space drops below 10 GB, the model is deleted.
- [ ] GPU with **more than 4 GB VRAM**, *or* CPU with **16 GB RAM or more and 4 or more cores**. Apple Silicon Macs with 16 GB qualify through either path.
- [ ] An unmetered network connection for the first download.

**Chrome**
1. [ ] Update Chrome desktop. Firebase hybrid needs 139 or newer. Chrome lists the web Prompt API as shipped in 148, so use the latest stable.
2. [ ] Open `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, set it to **Enabled**, and relaunch. Firebase's docs require this flag.
3. [ ] Open `chrome://on-device-internals`. Check the **Broker State** tab for errors, and look at the model status and size.
4. [ ] In DevTools on `http://localhost:3000`, run `await LanguageModel.availability()`.
   - `available`: ready.
   - `downloadable`: click **Download model** on `/spike`, or run `await LanguageModel.create()` in the console. Either way it needs a user gesture.
   - `downloading`: wait. The download can take several minutes. Check progress in `chrome://on-device-internals`.
   - `unavailable`: the hardware, disk space or flag check failed. Stop and report what `chrome://on-device-internals` shows.
5. If localhost still fails: restart Chrome, recheck Broker State, and repeat step 4.

## 2. Firebase console checklist (you do these)

- [ ] Create a Firebase project.
- [ ] Register a **Web app**. Copy its config into `apps/clerk/.env.local` (template in `apps/clerk/.env.example`).
- [ ] **AI Logic**: Firebase console → AI Logic → Get started → choose the **Gemini Developer API**.
- [ ] **App Check (development)**: no site key is needed. With `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` unset, the app runs App Check in **debug mode only** and logs a warning in the console. Register the debug token (next step) and you're done.
- [ ] *(Later, before production)* Create a **score-based reCAPTCHA Enterprise Web key** (not checkbox; do **not** add `localhost`), register it under App Check → Apps → your Web app, and set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`. Outside development, `getFirebase()` throws without it (fail-closed).
- [ ] **Debug token**: run the spike once (`pnpm dev`) and open DevTools. App Check logs `App Check debug token: <uuid>`. Add it under App Check → Apps → ⋮ → **Manage debug tokens**.
- [ ] Turn on App Check **enforcement** for Firebase AI Logic. Firebase auto-enforced it for AI Logic on Nov 2, 2026, so confirm it shows as enforced.
- [ ] Enable **Authentication** with the Google and Email/Password providers. Not used yet.
- [ ] Create a **Firestore** database in production mode. Not used yet.
- [ ] Enable **Remote Config**. Not used yet.

## 3. Run the spike

```bash
pnpm install
cp apps/clerk/.env.example apps/clerk/.env.local   # fill in the Firebase config; the site key can stay empty
pnpm --filter @splita/clerk dev
```

Open http://localhost:3000/spike in Chrome.

1. The status panel should read `available`. If it reads `downloadable`, click **Download model**.
2. **Run ON-DEVICE only** should show `source: on-device (on_device)`.
3. **Run CLOUD only** should show `source: cloud (in_cloud)`.
4. **Run PREFER_ON_DEVICE** should run on-device when Nano is available and fall back to cloud otherwise.

Latency is measured with `performance.now()` around `generateContent()`.

## Exit criteria

- [ ] ON-DEVICE only → source = on-device
- [ ] CLOUD only → source = cloud
- [ ] App Check active (debug token only, no site key) and calls succeed
- [ ] LICENSE detected on GitHub; `pnpm build` passes
