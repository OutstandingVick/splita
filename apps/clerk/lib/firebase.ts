"use client";

import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type AppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { type AI, getAI, GoogleAIBackend } from "firebase/ai";

declare global {
  // App Check reads this global before initializeAppCheck. `true` makes the SDK
  // generate a debug token and print it to the console for registration.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined;
}

// NEXT_PUBLIC_* must be referenced literally so Next inlines them at build time.
const env = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY,
} as const;

export class FirebaseConfigError extends Error {
  override name = "FirebaseConfigError";
}

function required(): Record<keyof typeof env, string> {
  const missing = Object.entries(env)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new FirebaseConfigError(
      `Missing env vars: ${missing.join(", ")}. Copy apps/clerk/.env.example to .env.local and fill it in.`,
    );
  }
  return env as Record<keyof typeof env, string>;
}

export interface FirebaseClients {
  app: FirebaseApp;
  appCheck: AppCheck;
  ai: AI;
}

let clients: FirebaseClients | undefined;

/** Lazily initializes Firebase, App Check and AI Logic. Browser-only. */
export function getFirebase(): FirebaseClients {
  if (clients) return clients;
  if (typeof window === "undefined") {
    throw new Error("getFirebase() must be called in the browser.");
  }
  const cfg = required();
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      });

  if (process.env.NODE_ENV === "development") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(cfg.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });

  const ai = getAI(app, { backend: new GoogleAIBackend() });

  clients = { app, appCheck, ai };
  return clients;
}
