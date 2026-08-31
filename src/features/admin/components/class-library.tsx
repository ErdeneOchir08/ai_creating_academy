import Link from 'next/link'
import {
    AlertTriangle,
    Archive,
    BookOpen,
    CalendarDays,
    CirclePause,
    CirclePlay,
    GraduationCap,
    Plus,
    Settings2,
    Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminClassSummary } from '@/features/admin/actions/class-control-actions.admin'
import { classTypeLabels } from '@/features/classes/domain/class-type'

type ClassView = 'current' | 'attention' | 'draft' | 'enrolling' | 'paused' | 'running' | 'finished' | 'history'

const views: Array<{ value: ClassView; label: string }> = [
    { value: 'current', label: 'Одоогийн анги' },
    { value: 'attention', label: 'Анхаарах' },
    { value: 'draft', label: 'Ноорог' },
    { value: 'enrolling', label: 'Элсэлттэй' },
    { value: 'paused', label: 'Түр хаасан' },
    { value: 'running', label: 'Явагдаж буй' },
    { value: 'finished', label: 'Дууссан' },
    { value: 'history', label: 'Түүхэн анги' },
]

const statusLabels: Record<AdminClassSummary['status'], string> = {
    draft: 'Ноорог',
    open: 'Элсэлт нээлттэй',
    closed: 'Элсэлт түр хаасан',
    in_progress: 'Явагдаж байгаа',
    completed: 'Дууссан',
    cancelled: 'Цуцлагдсан',
}

function normalizeView(value?: string): ClassView {
    return views.some((view) => view.value === value) ? value as ClassView : 'current'
}

function isInView(item: AdminClassSummary, view: ClassView) {
    if (view === 'history') return item.checkoutVersion === 1
    if (item.checkoutVersion !== 2) return false
    if (view === 'current') return true
    if (view === 'attention') return item.attentionCount > 0
    if (view === 'draft') return item.status === 'draft'
    if (view === 'enrolling') return item.status === 'open'
    if (view === 'paused') return item.status === 'closed'
    if (view === 'running') return item.status === 'in_progress'
    return item.status === 'completed' || item.status === 'cancelled'
}

function viewCount(classes: AdminClassSummary[], view: ClassView) {
    return classes.filter((item) => isInView(item, view)).length
}

function formatMnt(value: number | null) {
    return value === null ? 'Үнэ тохируулаагүй' : `₮ ${value.toLocaleString('mn-MN')}`
}

function formatDate(value: string | null) {
    return value
        ? new Intl.DateTimeFormat('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
        : 'Тодорхойгүй'
}

function StatusIcon({ status }: { status: AdminClassSummary['status'] }) {
    if (status === 'open') return <CirclePlay className="h-4 w-4" />
    if (status === 'closed') return <CirclePause className="h-4 w-4" />
    if (status === 'completed' || status === 'cancelled') return <Archive className="h-4 w-4" />
    return <CalendarDays className="h-4 w-4" />
}

export function ClassLibrary({
    classes,
    selectedView,
}: {
    classes: AdminClassSummary[]
    selectedView?: string
}) {
    const activeView = normalizeView(selectedView)
    const visibleClasses = classes.filter((item) => isInView(item, activeView))
    const currentClasses = classes.filter((item) => item.checkoutVersion === 2)
    const activeStudents = currentClasses.reduce((total, item) => total + item.activeEnrollmentCount, 0)
    const attentionCount = currentClasses.filter((item) => item.attentionCount > 0).length

    return (
        <div className="mx-auto max-w-7xl space-y-7 p-5 md:p-8">
            <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                    <div className="flex items-center gap-3">
                        <GraduationCap className="h-8 w-8 text-indigo-400" />
                        <h1 className="text-3xl font-bold text-white">Ангиуд</h1>
                    </div>
                    <p className="mt-2 max-w-3xl text-zinc-400">
                        Онлайн болон танхимын бүх анги, суралцагч, төлбөрийн төлөвийг нэг дороос харна.
                    </p>
                </div>
                <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
                    <Link href="/admin/classes/new"><Plus className="mr-2 h-4 w-4" />Шинэ анги үүсгэх</Link>
                </Button>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Одоогийн анги" value={currentClasses.length} icon={<GraduationCap className="h-5 w-5" />} />
                <SummaryCard label="Элсэлт нээлттэй" value={currentClasses.filter((item) => item.status === 'open').length} icon={<CirclePlay className="h-5 w-5" />} />
                <SummaryCard label="Идэвхтэй суралцагч" value={activeStudents} icon={<Users className="h-5 w-5" />} />
                <SummaryCard label="Анхаарах анги" value={attentionCount} icon={<AlertTriangle className="h-5 w-5" />} attention={attentionCount > 0} />
            </section>

            <nav className="flex gap-2 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2" aria-label="Ангийн төлөв">
                {views.map((view) => (
                    <Link
                        key={view.value}
                        href={view.value === 'current' ? '/admin/classes' : `/admin/classes?view=${view.value}`}
                        className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeView === view.value ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                        {view.label} <span className="ml-1 text-xs opacity-70">{viewCount(classes, view.value)}</span>
                    </Link>
                ))}
            </nav>

            {visibleClasses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
                    Энэ төлөвт анги алга байна.
                </div>
            ) : (
                <section className="grid gap-5 xl:grid-cols-2">
                    {visibleClasses.map((item) => (
                        <Card key={item.id} className="border-zinc-800 bg-zinc-950 text-white">
                            <CardHeader className="space-y-4">
                                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                    <div className="min-w-0">
                                        <p className="text-sm text-indigo-300">{item.programName}</p>
                                        <CardTitle className="mt-1 text-xl">{item.name}</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="w-fit border-zinc-700 text-zinc-300">
                                        <StatusIcon status={item.status} />
                                        <span className="ml-1.5">{statusLabels[item.status]}</span>
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge className="bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/10">{classTypeLabels[item.classType]}</Badge>
                                    {item.attentionCount > 0 && <Badge className="bg-amber-500/10 text-amber-200 hover:bg-amber-500/10">{item.attentionCount} анхаарах зүйл</Badge>}
                                    {item.checkoutVersion === 1 && <Badge variant="outline" className="border-zinc-700 text-zinc-500">Түүхэн урсгал</Badge>}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Info label="Үнэ" value={formatMnt(item.tuitionAmountMnt)} />
                                    <Info label="Эхлэх" value={formatDate(item.startsOn)} />
                                    <Info label="Видео хичээл" value={item.courseTitle ?? 'Холбоогүй'} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <Count label="Хүсэлт" value={item.applicationCount} />
                                    <Count label="Төлбөр хүлээж буй" value={item.pendingPaymentCount} />
                                    <Count label="Төлөгдсөн" value={item.paidPaymentCount} />
                                    <Count label="Суралцагч" value={item.activeEnrollmentCount} />
                                </div>
                                <Button asChild variant="outline" className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800">
                                    <Link href={`/admin/classes/${item.id}`}><Settings2 className="mr-2 h-4 w-4" />Ангийг удирдах</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </section>
            )}

            <p className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-100/80">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                Шинэ анги үүсгэх заавар нь зөвхөн тухайн ангид хэрэгтэй мэдээллийг харуулж, алхам бүрийн дараа ноорог хадгална. Хуучин ангиудыг “Түүхэн анги” хэсгээс тусад нь харна.
            </p>
        </div>
    )
}

function SummaryCard({ label, value, icon, attention = false }: { label: string; value: number; icon: React.ReactNode; attention?: boolean }) {
    return (
        <Card className={`border-zinc-800 bg-zinc-950 text-white ${attention ? 'border-amber-500/30' : ''}`}>
            <CardContent className="flex items-center justify-between p-5">
                <div><p className="text-sm text-zinc-500">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div>
                <span className={attention ? 'text-amber-300' : 'text-indigo-400'}>{icon}</span>
            </CardContent>
        </Card>
    )
}

function Info({ label, value }: { label: string; value: string }) {
    return <div className="min-w-0"><p className="text-xs text-zinc-600">{label}</p><p className="mt-1 truncate text-sm text-zinc-200" title={value}>{value}</p></div>
}

function Count({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
    return <div className={`rounded-lg border p-3 ${attention ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}><p className="text-xs text-zinc-500">{label}</p><p className={`mt-1 text-xl font-semibold ${attention ? 'text-amber-200' : 'text-white'}`}>{value}</p></div>
}
