import { create } from "zustand"

interface AuthModalStore {
  isOpen: boolean
  /** Why the modal opened on its own (a failed or required sign-in), shown above the buttons. */
  error: string | null
  /** Where to go after signing in; set when a protected page bounced the visitor here. */
  callbackUrl: string | null
  openModal: (opts?: { error?: string | null; callbackUrl?: string | null }) => void
  closeModal: () => void
}

export const useAuthModal = create<AuthModalStore>((set) => ({
  isOpen: false,
  error: null,
  callbackUrl: null,
  openModal: (opts) =>
    set({ isOpen: true, error: opts?.error ?? null, callbackUrl: opts?.callbackUrl ?? null }),
  closeModal: () => set({ isOpen: false, error: null }),
}))
