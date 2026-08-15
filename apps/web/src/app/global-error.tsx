'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-[#f6f7f9] px-5 text-[#171a21]">
        <main className="max-w-md text-center">
          <h1 className="text-3xl font-semibold">NEXORA is temporarily unavailable</h1>
          <p className="mt-3 text-sm text-[#596170]">
            A critical interface error occurred. Retry the application to continue.
          </p>
          <button
            className="mt-6 rounded-md bg-[#3159c8] px-4 py-2.5 text-sm font-semibold text-white"
            onClick={reset}
            type="button"
          >
            Retry application
          </button>
        </main>
      </body>
    </html>
  )
}
