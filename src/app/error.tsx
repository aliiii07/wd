"use client";

// Shown when something goes wrong on a page, e.g. a required form field was empty.
// Note: in production (npm run build + start) server error messages are hidden
// for safety, so only a generic message appears.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-6">
      <h2 className="font-medium text-red-800">Something went wrong</h2>
      <p className="mt-2 text-sm text-red-700">{error.message}</p>
      <button onClick={() => retry()} className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm text-white">
        Try again
      </button>
    </div>
  );
}
