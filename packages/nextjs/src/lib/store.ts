import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Actor } from "./hedera";

interface AppState {
  actor: Actor;
  setActor: (a: Actor) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      actor: "buyer",
      setActor: (actor) => set({ actor }),
    }),
    { name: "fixpoint-actor" }
  )
);
