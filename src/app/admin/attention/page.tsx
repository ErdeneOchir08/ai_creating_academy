import Link from 'next/link'
import {
    AlertTriangle,
    ArrowRight,
    Banknote,
    CheckCircle2,
    CircleHelp,
    CreditCard,
    GraduationCap,
    MessageSquareText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAdminOverview } from '@/features/admin/actions/admin-actions'
import { buildAdminAttentionItems, type AdminAttentionItem } from '@/features/admin/domain/admin-attention'

const itemIcons: Record<AdminAttentionItem['id'], typeof AlertTriangle> = {
    'manual-payments': Banknote,
    'qpay-problems': CreditCard,
    questions: MessageSquareText,
    'draft-classes': GraduationCap,
}

export default async function AdminAttentionPage() {
    const overview = await getAdminOverview()
    const items = buildAdminAttentionItems(overview.attention)

    return (
        <div className="mx-auto max-w-6xl space-y-7 p-5 md:p-8">
            <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-8 w-8 text-amber-300" />
                        <h1 className="text-3xl font-bold text-white">Анхаарах ажил</h1>
                    </div>
                    <p className="mt-2 text-zinc-400">Зөвхөн таны шийдвэр эсвэл шалгалт шаардлагатай ажлууд энд харагдана.</p>
                </div>
                <Button asChild variant="outline" className="border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-900">
                    <Link href="/admin">Тойм руу буцах</Link>
                </Button>
            </header>

            {items.length === 0 ? (
                <Card className="border-emerald-500/30 bg-emerald-500/10 text-white">
                    <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-300" />
                        <h2 className="mt-4 text-2xl font-bold">Бүх ажил цэгцтэй байна</h2>
                        <p className="mt-2 max-w-xl text-zinc-300">Одоогоор админы шийдвэр хүлээж буй төлбөр, асуулт эсвэл дуусгах ноорог анги алга.</p>
                    </CardContent>
                </Card>
            ) : (
                <section className="grid gap-4 md:grid-cols-2" aria-label="Шийдвэрлэх ажлууд">
                    {items.map((item) => {
                        const Icon = itemIcons[item.id]
                        return (
                            <Link key={item.id} href={item.href} className="group">
                                <Card className={`h-full text-white transition-colors ${item.priority === 'urgent' ? 'border-amber-500/35 bg-amber-500/5 group-hover:border-amber-400/70' : 'border-zinc-800 bg-zinc-950 group-hover:border-indigo-500/50'}`}>
                                    <CardContent className="flex h-full items-start gap-4 p-6">
                                        <span className={`rounded-xl p-3 ${item.priority === 'urgent' ? 'bg-amber-500/15 text-amber-300' : 'bg-indigo-500/15 text-indigo-300'}`}>
                                            <Icon className="h-6 w-6" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3">
                                                <h2 className="text-lg font-semibold">{item.title}</h2>
                                                <span className="rounded-full bg-white/10 px-2.5 py-1 text-sm font-bold">{item.count}</span>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                                            <span className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-300">
                                                Нээх <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })}
                </section>
            )}

            <section className="grid gap-4 lg:grid-cols-2">
                <Card className="border-blue-500/20 bg-blue-500/5 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-blue-300" />QPay дээр хийх зүйл</CardTitle>
                        <CardDescription className="text-zinc-400">QPay төлбөр амжилттай бол систем эрхийг өөрөө нээнэ.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-zinc-300">
                        <p>• “Төлбөр хүлээж буй” төлөв бол суралцагч төлж дуусаагүй гэсэн үг. Админ батлахгүй.</p>
                        <p>• Зөвхөн “Асуудалтай” төлбөр гарвал шалгана.</p>
                        <p>• Амжилттай төлбөрийг төлбөрийн түүхээс харна.</p>
                    </CardContent>
                </Card>

                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CircleHelp className="h-5 w-5 text-indigo-300" />Хаанаас юу хийх вэ?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-zinc-300">
                        <p><strong className="text-white">Ангиуд:</strong> үнэ, хугацаа, багш, хуваарь, элсэлтийн төлөв.</p>
                        <p><strong className="text-white">Төлбөрүүд:</strong> QPay хяналт болон банкны баримт.</p>
                        <p><strong className="text-white">Хичээлийн контент:</strong> суралцагчийн үзэх видео хичээл.</p>
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}
