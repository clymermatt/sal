export default async function VerifyFailedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const error = params.error ?? "This login link has expired or already been used.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Link expired</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <a href="/auth/login" className="text-blue-600 underline">
          Request a new one
        </a>
      </div>
    </div>
  );
}
