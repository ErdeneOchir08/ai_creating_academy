export default function Loading() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-white" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 px-5 py-4 shadow-2xl">
                <span className="h-3 w-3 animate-pulse rounded-full bg-indigo-400" aria-hidden="true" />
                <p className="text-sm text-zinc-300">Mind Academy ачаалж байна...</p>
            </div>
        </main>
    )
}
