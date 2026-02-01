'use client'

import { signIn } from 'next-auth/react'
import { useAuthModal } from '@/lib/stores/auth-modal'
import { Button } from '@/stories/button/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/stories/dialog/dialog'

export function AuthModal() {
  const { isOpen, closeModal } = useAuthModal()

  const handleSignIn = async (provider: string) => {
    await signIn(provider, { callbackUrl: '/cnet/dashboard' })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-[425px] bg-white border border-black rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">Sign In</DialogTitle>
          <DialogDescription className="text-gray-600">
            Sign in to access the C-Net dashboard and manage your infrastructure.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 mt-6">
          <Button
            onClick={() => handleSignIn('github')}
            className="w-full bg-black hover:bg-gray-800 text-white rounded-xl py-3 text-base font-medium"
          >
            Continue with GitHub
          </Button>
          
          <Button
            onClick={() => handleSignIn('google')}
            variant="outline"
            className="w-full border-black text-black hover:bg-gray-100 rounded-xl py-3 text-base font-medium"
          >
            Continue with Google
          </Button>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">or</span>
            </div>
          </div>
          
          <Button
            onClick={() => handleSignIn('credentials')}
            variant="outline"
            className="w-full border-black text-black hover:bg-gray-100 rounded-xl py-3 text-base font-medium"
          >
            Sign in with Email
          </Button>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </DialogContent>
    </Dialog>
  )
}
