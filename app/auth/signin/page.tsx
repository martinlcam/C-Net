"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-primary-purple-60">
            Sign in to C-Net
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-70">Access your homelab dashboard</p>
        </div>
        <div className="mt-8 space-y-6">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/cnet/dashboard" })}
            className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-purple-50 hover:bg-primary-purple-55 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-purple-40 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" role="img" aria-label="Google logo">
              <title>Google</title>
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
          <div className="text-center">
            <Link href="/" className="text-sm text-primary-purple-50 hover:text-primary-purple-55">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
