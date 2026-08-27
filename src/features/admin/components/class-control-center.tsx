import Link from 'next/link'
import {
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    CreditCard,
    Eye,
    FileSignature,
    History,
    MapPin,
    PencilLine,
    Settings2,
    Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminClassControl } from '@/features/admin/actions/class-control-actions.admin'
import { classTypeLabels } from '@/features/classes/domain/class-type'

const statusLabels: Record<AdminClassControl['status'], string> = {
    draft: 'Ноорог',
    open: 'Элсэлт нээлттэй',
    closed: 'Элсэлт түр хаасан',
    in_progress: 'Явагдаж байгаа',
    completed: 'Дууссан',
    cancelled: 'Цуцлагдсан',
}

const applicationLabels: Record<string, string> = {
    draft: 'Мэдээлэл дутуу',
    submitted: 'Хянагдаж буй',
    approved: 'Баталгаажсан',
    withdrawn: 'Цуцалсан',
    rejected: 'Буцаасан',
}

const paymentLabels: Record<string, string> = {
    created: 'Нэхэмжлэл үүссэн',
    pending: 'Төлбөр хүлээж буй',
    paid: 'Төлөгдсөн',
    approved: 'Зөвшөөрсөн',
    rejected: 'Засвар шаардсан',
    failed: 'Алдаатай',
    expired: 'Хугацаа дууссан',
    cancelled: 'Цуцлагдсан',
    refunded: 'Буцаан олгосон',
}

function formatMnt(value: number | null) {
    return value === null ? 'Тохируулаагүй' : `₮ ${value.toLocaleString('mn-MN')}`
}

function formatDate(value: string | null) {
    return value
        ? new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium' }).format(new Date(value))
        : 'Тодорхойгүй'
}

function nextAction(item: AdminClassControl) {
    if (item.status === 'draft') return {
        title: 'Ангийн тохиргоог дуусгаад нийтэлнэ үү',
        description: 'Видео хичээл, үнэ, хугацаа болон гэрээний мэдээллийг шалгаад суралцагчийн харагдацыг урьдчилан үзнэ.',
        href: `/admin/programs/${item.programId}`,
        label: 'Тохиргоог үргэлжлүүлэх',
        attention: true,
    }
    if (item.pendingPaymentCount > 0 || item.paymentIssueCount > 0) return {
        title: `${item.pendingPaymentCount + item.paymentIssueCount} төлбөр анхаарах шаардлагатай`,
        description: 'Хүлээгдэж буй болон алдаатай төлбөрүүдийг шалгана уу.',
        href: '/admin/payments',
        label: 'Төлбөрүүдийг шалгах',
        attention: true,
    }
    if (item.status === 'open') return {
        title: 'Элсэлт хэвийн ажиллаж байна',
        description: 'Шинэ суралцагчид бүртгүүлж, QPay төлбөр хийх боломжтой.',
        href: `/programs/${item.id}`,
        label: 'Суралцагчийн хуудсыг харах',
        attention: false,
    }
    if (item.status === 'closed') return {
        title: 'Шинэ элсэлт түр хаалттай',
        description: 'Одоогийн суралцагч, төлбөр болон хичээл үзэх эрх өөрчлөгдөөгүй.',
        href: `/admin/programs/${item.programId}`,
        label: 'Удирдлагыг нээх',
        attention: false,
    }
    if (item.status === 'in_progress') return {
        title: 'Сургалт явагдаж байна',
        description: 'Суралцагчдын бүртгэл болон хичээл үзэх эрхийг эндээс хянаарай.',
        href: '#students',
        label: 'Суралцагчдыг харах',
        attention: false,
    }
    return {
        title: 'Энэ анги түүхэнд хадгалагдсан',
        description: 'Гэрээ, төлбөр болон суралцагчийн түүх өөрчлөгдөхгүй хадгалагдана.',
        href: '#history',
        label: 'Түүхийг харах',
        attention: false,
    }
}

export function ClassControlCenter({ classControl }: { classControl: AdminClassControl }) {
    const action = nextAction(classControl)

    return (
        <div className="mx-auto max-w-7xl space-y-7 p-5 md:p-8">
            <header>
                <Button asChild variant="ghost" className="mb-4 px-0 text-zinc-400 hover:bg-transparent hover:text-white">
                    <Link href="/admin/classes"><ArrowLeft className="mr-2 h-4 w-4" />Бүх анги руу буцах</Link>
                </Button>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                        <p className="text-sm font-medium text-indigo-300">{classControl.programName}</p>
                        <h1 className="mt-1 text-3xl font-bold text-white">{classControl.name}</h1>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className="bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/10">{classTypeLabels[classControl.classType]}</Badge>
                            <Badge variant="outline" className="border-zinc-700 text-zinc-300">{statusLabels[classControl.status]}</Badge>
                            {classControl.checkoutVersion === 1 && <Badge variant="outline" className="border-zinc-700 text-zinc-500">Түүхэн урсгал</Badge>}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline"><Link href={`/admin/programs/${classControl.programId}/cohorts/${classControl.id}/preview`}><Eye className="mr-2 h-4 w-4" />Урьдчилан харах</Link></Button>
                        <Button asChild variant="outline"><Link href={`/admin/programs/${classControl.programId}`}><PencilLine className="mr-2 h-4 w-4" />Тохиргоо засах</Link></Button>
                    </div>
                </div>
            </header>

            <Card className={`${action.attention ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/25 bg-emerald-500/5'} text-white`}>
                <CardContent className="flex flex-col justify-between gap-5 p-6 md:flex-row md:items-center">
                    <div className="flex items-start gap-3">
                        {action.attention ? <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" /> : <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />}
                        <div><p className="font-semibold">Дараагийн алхам: {action.title}</p><p className="mt-1 text-sm text-zinc-400">{action.description}</p></div>
                    </div>
                    <Button asChild className={action.attention ? 'bg-amber-500 text-black hover:bg-amber-400' : ''}><Link href={action.href}>{action.label}</Link></Button>
                </CardContent>
            </Card>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon={<Users />} label="Идэвхтэй суралцагч" value={String(classControl.activeEnrollmentCount)} />
                <Metric icon={<CreditCard />} label="Төлөгдсөн" value={String(classControl.paidPaymentCount)} />
                <Metric icon={<AlertTriangle />} label="Хүлээгдэж буй төлбөр" value={String(classControl.pendingPaymentCount)} attention={classControl.pendingPaymentCount > 0} />
                <Metric icon={<CalendarDays />} label="Ангийн төлөв" value={statusLabels[classControl.status]} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader><CardTitle>Ангийн мэдээлэл</CardTitle><CardDescription className="text-zinc-500">Өдөр тутам хэрэгтэй үндсэн мэдээлэл.</CardDescription></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <Detail icon={<CreditCard />} label="Үнэ" value={formatMnt(classControl.tuitionAmountMnt)} />
                        <Detail icon={<Users />} label="Ангийн хэмжээ" value={classControl.capacity ? `${classControl.capacity} суралцагч` : 'Хязгааргүй / мэдээлээгүй'} />
                        <Detail icon={<CalendarDays />} label="Хугацаа" value={`${formatDate(classControl.startsOn)} – ${formatDate(classControl.endsOn)}`} />
                        <Detail icon={<BookOpen />} label="Видео хичээл" value={classControl.courseTitle ?? 'Холбоогүй'} />
                        <Detail icon={<FileSignature />} label="Гэрээ" value={classControl.contractPolicy === 'required' ? classControl.contractTitle ?? 'Сонгоогүй' : 'Шаардлагагүй'} />
                        <Detail icon={<MapPin />} label={classControl.deliveryMode === 'offline' ? 'Байршил' : 'Хуваарь'} value={classControl.deliveryMode === 'offline' ? classControl.location || 'Оруулаагүй' : classControl.scheduleSummary || 'Оруулаагүй'} />
                    </CardContent>
                </Card>

                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader><CardTitle>Төлбөрийн аргууд</CardTitle><CardDescription className="text-zinc-500">Шинээр төлөх суралцагчдад харагдана.</CardDescription></CardHeader>
                    <CardContent className="space-y-3">
                        <PaymentMethod label="QPay автомат" enabled={classControl.qpayEnabled} />
                        <PaymentMethod label="Банкны шилжүүлэг" enabled={classControl.manualTransferEnabled} />
                        <Button asChild variant="outline" className="mt-2 w-full"><Link href="/admin/payments"><CreditCard className="mr-2 h-4 w-4" />Бүх төлбөрийг харах</Link></Button>
                    </CardContent>
                </Card>
            </section>

            <Card id="students" className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader><CardTitle>Суралцагчид · {classControl.students.length}</CardTitle><CardDescription className="text-zinc-500">Энэ ангид бүртгүүлсэн хүмүүсийн төлөв.</CardDescription></CardHeader>
                <CardContent>
                    {classControl.students.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">Одоогоор суралцагч бүртгүүлээгүй байна.</p>
                    ) : (
                        <div className="space-y-3">
                            {classControl.students.map((student) => (
                                <div key={student.applicationId} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
                                    <div><p className="font-medium">{student.learnerName}</p><p className="mt-1 text-xs text-zinc-500">{student.contactEmail}</p></div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">{applicationLabels[student.applicationStatus] ?? student.applicationStatus}</Badge>
                                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">{student.paymentStatus ? paymentLabels[student.paymentStatus] ?? student.paymentStatus : 'Төлбөр үүсээгүй'}</Badge>
                                        {student.enrollmentStatus === 'active' && <Badge className="bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">Хичээл нээгдсэн</Badge>}
                                    </div>
                                    <span className="text-xs text-zinc-600">{formatDate(student.createdAt)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card id="history" className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-indigo-400" />Тохиргоо ба түүх</CardTitle><CardDescription className="text-zinc-500">Өмнөх төлбөр, гэрээ, эрхийг өөрчлөхгүйгээр хадгалсан өөрчлөлтүүд.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                    {classControl.configurationChanges.length === 0 ? <p className="text-sm text-zinc-500">Одоогоор бүртгэгдсэн тохиргооны өөрчлөлт алга.</p> : classControl.configurationChanges.map((change) => (
                        <div key={change.revision} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                            <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">Өөрчлөлт {change.revision}</p><p className="text-xs text-zinc-600">{formatDate(change.changedAt)}</p></div>
                            <p className="mt-2 text-sm text-zinc-400">{change.reason || 'Тохиргоо шинэчилсэн'}</p>
                        </div>
                    ))}
                    <Button asChild variant="outline"><Link href={`/admin/programs/${classControl.programId}`}><Settings2 className="mr-2 h-4 w-4" />Нарийн тохиргоо ба түүх</Link></Button>
                </CardContent>
            </Card>
        </div>
    )
}

function Metric({ icon, label, value, attention = false }: { icon: React.ReactNode; label: string; value: string; attention?: boolean }) {
    return <Card className={`border-zinc-800 bg-zinc-950 text-white ${attention ? 'border-amber-500/30' : ''}`}><CardContent className="flex items-center gap-4 p-5"><span className={attention ? 'text-amber-300' : 'text-indigo-400'}>{icon}</span><div><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div></CardContent></Card>
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return <div className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"><span className="mt-0.5 text-indigo-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><div className="min-w-0"><p className="text-xs text-zinc-600">{label}</p><p className="mt-1 break-words text-sm text-zinc-200">{value}</p></div></div>
}

function PaymentMethod({ label, enabled }: { label: string; enabled: boolean }) {
    return <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"><span className="text-sm">{label}</span><Badge className={enabled ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-800'}>{enabled ? 'Идэвхтэй' : 'Түр зогссон'}</Badge></div>
}
