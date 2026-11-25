"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { type DeviceBadge, deviceBadge, type NanoState } from "@/lib/device-badge";
import { getSplita } from "@/lib/splita";

interface DeviceStatus {
  nano: NanoState;
  online: boolean;
  badge: DeviceBadge;
  /** Anonymous Firebase uid (receipts are stored under it), once signed in. */
  uid: string | null;
  setupError: string | null;
}

const Ctx = createContext<DeviceStatus>({
  nano: "warming",
  online: true,
  badge: deviceBadge("warming", true),
  uid: null,
  setupError: null,
});

export const useDeviceStatus = () => useContext(Ctx);

/** Warms Gemini Nano once per page load, signs in anonymously, and tracks online/offline. */
export function DeviceStatusProvider({ children }: { children: ReactNode }) {
  const [nano, setNano] = useState<NanoState>("warming");
  const [online, setOnline] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    try {
      const splita = getSplita();
      void splita.warmUpNano().then((s) => {
        setNano(s);
        if (s !== "ready") console.warn(`[splita] Nano warm-up ${s}: ${splita.nanoError ?? "no detail"}`);
      });
      // Sign in and open the Firestore connection now, so the Receipt stage is just one write.
      if (navigator.onLine) {
        splita.signIn().then(
          (id) => {
            setUid(id);
            const matter = new URLSearchParams(window.location.search).get("matter") ?? undefined;
            void splita.warmUpCloud(matter);
          },
          (e: unknown) => setSetupError(String(e)),
        );
      }
    } catch (e) {
      setNano("unavailable");
      setSetupError(String(e));
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return <Ctx.Provider value={{ nano, online, badge: deviceBadge(nano, online), uid, setupError }}>{children}</Ctx.Provider>;
}

const TONE: Record<DeviceBadge["tone"], string> = {
  ready: "border-accent-100 bg-accent-50 text-accent-800",
  rules: "border-amber-200 bg-amber-50 text-amber-900",
  offline: "border-stone-300 bg-stone-100 text-stone-700",
  pending: "border-stone-200 bg-white text-stone-500",
};

const DOT: Record<DeviceBadge["tone"], string> = {
  ready: "bg-accent-600",
  rules: "bg-amber-500",
  offline: "bg-stone-500",
  pending: "bg-stone-300 animate-pulse",
};

export function StatusBadge() {
  const { badge } = useDeviceStatus();
  return (
    <span
      role="status"
      title={badge.detail}
      data-testid="device-badge"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${TONE[badge.tone]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[badge.tone]}`} />
      {badge.label}
    </span>
  );
}
