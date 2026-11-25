"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createMatter, type KeyValueStore, loadMatters, type Matter, removeMatter, saveMatters, updateMatter, withDemo } from "./matters";

function browserStore(): KeyValueStore {
  return {
    getItem: (k) => {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        // Private mode or full storage: matters live for this session only.
      }
    },
  };
}

/** Matters on this device, with the demo matter always available. Saves are debounced. */
export function useMatters(initialId?: string | null) {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const list = withDemo(loadMatters(browserStore()));
    setMatters(list);
    setSelectedId(list.find((m) => m.id === initialId)?.id ?? list[0]?.id ?? null);
    setLoaded(true);
  }, [initialId]);

  const persist = useCallback((next: Matter[]) => {
    setMatters(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMatters(browserStore(), next), 300);
  }, []);

  const create = useCallback(
    (title: string) => {
      const m = createMatter(title);
      persist([m, ...matters]);
      setSelectedId(m.id);
      return m;
    },
    [matters, persist],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<Matter, "title" | "document" | "question">>) => persist(updateMatter(matters, id, patch)),
    [matters, persist],
  );

  const remove = useCallback(
    (id: string) => {
      const next = removeMatter(matters, id);
      persist(next);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
    },
    [matters, persist, selectedId],
  );

  return { matters, loaded, selected: matters.find((m) => m.id === selectedId) ?? null, select: setSelectedId, create, update, remove };
}
