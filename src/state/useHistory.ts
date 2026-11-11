import { useCallback, useRef, useState } from 'react';

type Updater<T> = T | ((prev: T) => T);

/**
 * State with undo/redo. Rapid consecutive updates (e.g. dragging a slider)
 * are coalesced into a single history step.
 */
export function useHistory<T>(initial: T | (() => T), limit = 100) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastPush = useRef(0);
  const presentRef = useRef(present);
  presentRef.current = present;
  const [, force] = useState(0);

  const set = useCallback(
    (updater: Updater<T>, options?: { coalesce?: boolean; skipHistory?: boolean }) => {
      const prev = presentRef.current;
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      if (next === prev) return;
      if (!options?.skipHistory) {
        const now = performance.now();
        const coalesce = options?.coalesce !== false && now - lastPush.current < 450;
        if (!coalesce) {
          past.current.push(prev);
          if (past.current.length > limit) past.current.shift();
        }
        lastPush.current = now;
        future.current = [];
      }
      presentRef.current = next;
      setPresent(next);
    },
    [limit]
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(presentRef.current);
    presentRef.current = prev;
    lastPush.current = 0;
    setPresent(prev);
    force((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(presentRef.current);
    presentRef.current = next;
    lastPush.current = 0;
    setPresent(next);
    force((n) => n + 1);
  }, []);

  /** Replace state and clear history (e.g. loading a project). */
  const reset = useCallback((value: T) => {
    past.current = [];
    future.current = [];
    lastPush.current = 0;
    presentRef.current = value;
    setPresent(value);
  }, []);

  return {
    state: present,
    set,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
