import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="font-serif text-3xl">Not found</h1>
      <p className="mt-2 text-muted">That page or record doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 inline-block text-rose">Back to dashboard</Link>
    </div>
  );
}
