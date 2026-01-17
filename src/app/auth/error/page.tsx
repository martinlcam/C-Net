import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-accent-red-70">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-70">
            An error occurred during authentication
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <p className="text-center text-neutral-70">
            Please try signing in again or contact support if the problem persists.
          </p>
          <div className="space-y-3">
            <Link
              href="/auth/signin"
              className="w-full flex justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-purple-50 hover:bg-primary-purple-55 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-purple-40 transition-colors"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="w-full flex justify-center px-4 py-3 border border-neutral-30 rounded-md shadow-sm text-sm font-medium text-neutral-70 bg-white hover:bg-neutral-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-purple-40 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
