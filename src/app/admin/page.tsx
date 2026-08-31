import Link from 'next/link'
import {
    AlertTriangle,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    CreditCard,
    GraduationCap,
    Users,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAdminOverview } from '@/features/admin/actions/admin-actions'
import { buildAdminAttentionItems } from '@/features/admin/domain/admin-attention'

export default async function AdminPage() {
    const overview = await getAdminOverview()
    const attentionItems = buildAdminAttentionItems(overview.attention)
    const cards = [
        { label: 'Одоогийн анги', value: overview.currentClasses, description: 'Шинэ удирдлагаар ажиллах анги', href: '/admin/classes', icon: GraduationCap },
        { label: 'Идэвхтэй суралцагч', value: overview.activeEnrollments, description: 'Одоогоор хичээл үзэх эрхтэй', href: '/admin/classes', icon: Users },
        { label: 'Видео контент', value: overview.courses, description: 'Ангид холбож ашиглах хичээл', href: '/admin/courses', icon: BookOpen },
        { label: 'QPay амжилттай', value: overview.qpayPaid, description: 'Автоматаар баталгаажсан төлбөр', href: '/admin/payments?type=qpay&status=approved', icon: CreditCard },
    ]

    return (
        <div className="mx-auto max-w-7xl space-y-7 p-5 md:p-8">
            <header>
                <h1 className="text-3xl font-bold text-white">Өнөөдрийн удирдлага</h1>
                <p className="mt-2 text-zinc-400">Эхлээд анхаарах ажлаа шийдээд, дараа нь анги болон төлбөрөө хянана.</p>
            </header>

            <Link href="/admin/attention" className="group block">
                <Card className={`overflow-hidden text-white transition-colors ${overview.attentionTotal > 0 ? 'border-amber-500/40 bg-amber-500/10 group-hover:border-amber-400/70' : 'border-emerald-500/30 bg-emerald-500/10 group-hover:border-emerald-400/60'}`}>
                    <CardContent className="flex flex-col justify-between gap-5 p-6 md:flex-row md:items-center">
                        <div className="flex items-start gap-4">
                            <span className={`rounded-xl p-3 ${overview.attentionTotal > 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                                {overview.attentionTotal > 0 ? <AlertTriangle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
                            </span>
                            <div>
                                <p className="text-sm font-medium text-zinc-300">АНХААРАХ АЖИЛ</p>
                                <p className="mt-1 text-4xl font-bold">{overview.attentionTotal}</p>
                                <p className="mt-2 text-sm text-zinc-300">
                                    {overview.attentionTotal > 0
                                        ? `${attentionItems.length} төрлийн ажил таны шийдвэрийг хүлээж байна.`
                                        : 'Яаралтай шийдэх ажил алга. Бүх зүйл хэвийн байна.'}
                                </p>
                            </div>
                        </div>
                        <span className="flex items-center gap-2 text-sm font-semibold text-white">
                            {overview.attentionTotal > 0 ? 'Ажлаа нээх' : 'Шалгах'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </CardContent>
                </Card>
            </Link>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Үндсэн үзүүлэлтүүд">
                {cards.map((card) => {
                    const Icon = card.icon
                    return (
                        <Link key={card.label} href={card.href} className="group">
                            <Card className="h-full border-zinc-800 bg-zinc-950 text-white transition-colors group-hover:border-indigo-500/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-zinc-300">{card.label}</CardTitle>
                                    <Icon className="h-4 w-4 text-indigo-400" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{card.value}</p>
                                    <CardDescription className="mt-1 text-zinc-500">{card.description}</CardDescription>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader>
                        <CardTitle>Өдөр бүр ажиллах дараалал</CardTitle>
                        <CardDescription className="text-zinc-400">Админ хэсгийг энэ гурван алхмаар ашиглана.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                        <FlowStep number="1" title="Анхаарах" description="Шийдвэр хүлээж буй ажлаа дуусгана." href="/admin/attention" />
                        <FlowStep number="2" title="Ангиуд" description="Анги, үнэ, хугацаа, хуваариа удирдана." href="/admin/classes" />
                        <FlowStep number="3" title="Төлбөр" description="QPay орлогоо хянана." href="/admin/payments" />
                    </CardContent>
                </Card>

                <Card className="border-blue-500/20 bg-blue-500/5 text-white">
                    <CardHeader>
                        <CardTitle>QPay автомат хяналт</CardTitle>
                        <CardDescription className="text-zinc-400">Амжилттай QPay төлбөрийг админ гараар батлах шаардлагагүй.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                        <Stat label="Төлбөр хүлээж буй" value={overview.qpayWaiting} />
                        <Stat label="Амжилттай" value={overview.qpayPaid} accent />
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}

function FlowStep({ number, title, description, href }: { number: string; title: string; description: string; href: string }) {
    return (
        <Link href={href} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-indigo-500/50 hover:bg-zinc-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-bold text-indigo-300">{number}</span>
            <p className="mt-3 font-semibold">{title}</p>
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </Link>
    )
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
        </div>
    )
}
