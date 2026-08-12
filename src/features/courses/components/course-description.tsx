export function CourseDescription({
    description,
    compact = false,
}: {
    description: string
    compact?: boolean
}) {
    return (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-sm">
            <div className="border-b border-white/5 bg-white/[0.025] px-5 py-3 sm:px-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-indigo-300">
                    Сургалтын тухай
                </h2>
            </div>
            <p className={`whitespace-pre-line break-words px-5 py-5 font-normal text-zinc-300 sm:px-6 ${compact ? 'text-base leading-7' : 'text-base leading-8 sm:text-lg'}`}>
                {description}
            </p>
        </section>
    )
}
