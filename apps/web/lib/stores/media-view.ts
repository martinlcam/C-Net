import { create } from "zustand"

interface MediaViewStore {
  // True while a title is open for viewing (player or series detail modal).
  viewing: boolean
  setViewing: (viewing: boolean) => void
}

export const useMediaViewStore = create<MediaViewStore>((set) => ({
  viewing: false,
  setViewing: (viewing) => set({ viewing }),
}))
