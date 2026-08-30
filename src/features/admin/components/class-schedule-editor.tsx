'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Plus, ShieldCheck, Trash2 } from 'lucide-react'

import { updatePublishedClassSchedule } from '@/features/admin/actions/published-class-schedule-actions.admin'
import type { AdminClassControl } from '@/features/admin/actions/class-control-actions.admin'
import type { TeacherOption } from '@/features/admin/actions/guided-class-actions.admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type SessionRow = AdminClassControl['sessions'][number] & { key: string }

function academyDateTimeInput(value: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Ulaanbaatar',
    }).formatToParts(new Date(value))
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

export function ClassScheduleEditor({
    classControl,
    teachers,
}: {
    classControl: AdminClassControl
    teachers: TeacherOption[]
}) {
    const router = useRouter()
    const [sessions, setSessions] = useState<SessionRow[]>(() => classControl.sessions.map((session) => ({
        ...session,
        key: session.id,
    })))
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<Awaited<ReturnType<typeof updatePublishedClassSchedule>> | null>(null)
    const hasStartedSession = classControl.sessions.some((session) => Date.parse(session.startsAt) <= Date.now())
    const isOnline = classControl.classType === 'instructor_led_online'

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!confirm('Шинэ хуваарийг хадгалаад идэвхтэй суралцагчдад и-мэйлээр мэдэгдэх үү?')) return
        setPending(true)
        setError('')
        try {
            const updateResult = await updatePublishedClassSchedule(classControl.id, new FormData(event.currentTarget))
            setResult(updateResult)
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Хуваарийг хадгалж чадсангүй.')
        } finally {
            setPending(false)
        }
    }

    if (result) {
        return (
            <div className="mx-auto max-w-3xl p-5 sm:p-8">
                <Card className="border-emerald-500/30 bg-emerald-500/5 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-6 w-6 text-emerald-300" />Хуваарь шинэчлэгдлээ</CardTitle>
                        <CardDescription className="text-zinc-300">Өөрчлөлт {result.revision} түүхэнд хадгалагдсан.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-zinc-200">{result.notifiedCount} суралцагчид и-мэйл амжилттай илгээлээ.</p>
                        {result.notificationFailureCount > 0 && (
                            <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                                Хуваарь хадгалагдсан боловч {result.notificationFailureCount} и-мэйл хүрээгүй. Алдаа хүргэлтийн бүртгэлд хадгалагдсан.
                            </p>
                        )}
                        <p className="flex items-start gap-2 text-sm text-emerald-100"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Төлбөр, гэрээ болон хичээл үзэх эрх өөрчлөгдөөгүй.</p>
                        <Button asChild><Link href={`/admin/classes/${classControl.id}`}>Ангийн удирдлага руу буцах</Link></Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8">
            <header>
                <Button asChild variant="ghost" className="mb-3 px-0 text-zinc-400 hover:bg-transparent hover:text-white">
                    <Link href={`/admin/classes/${classControl.id}`}><ArrowLeft className="mr-2 h-4 w-4" />Ангийн удирдлага руу буцах</Link>
                </Button>
                <h1 className="text-3xl font-bold text-white">Хуваарь засах</h1>
                <p className="mt-2 text-sm text-zinc-400">{classControl.programName} · {classControl.name}</p>
            </header>

            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4 text-sm text-indigo-100">
                <p className="font-semibold">Энэ хэсэг зөвхөн хуваарьт нөлөөлнө.</p>
                <p className="mt-1 text-indigo-200/80">Багш, өдөр, цаг, уулзалтын холбоос эсвэл танхимыг өөрчилж болно. Үнэ, QPay төлбөр, гэрээ, видео хичээлийн эрх өөрчлөгдөхгүй.</p>
            </div>

            {hasStartedSession && (
                <p role="alert" className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />Нэг хичээл аль хэдийн эхэлсэн тул энэ энгийн засвар түгжигдсэн. Суралцагчдад нөлөөлөх тусгай шийдвэр шаардлагатай.
                </p>
            )}
            {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

            <form onSubmit={(event) => void submit(event)}>
                <input type="hidden" name="expected_revision" value={classControl.configurationRevision} readOnly />
                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-indigo-300" />Шинэ хуваарь</CardTitle>
                        <CardDescription className="text-zinc-500">Цагуудыг Улаанбаатарын цагаар оруулна.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                            <span>Хариуцах багш *</span>
                            <select name="teacher_user_id" required defaultValue={classControl.teacherUserId ?? ''} className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm">
                                <option value="" disabled>Багш сонгох</option>
                                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                            </select>
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span>Эхлэх өдөр *</span>
                            <Input name="starts_on" type="date" required defaultValue={classControl.startsOn ?? ''} className="border-zinc-700 bg-zinc-900" />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span>Дуусах өдөр *</span>
                            <Input name="ends_on" type="date" required defaultValue={classControl.endsOn ?? ''} className="border-zinc-700 bg-zinc-900" />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                            <span>Хуваарийн товч тайлбар *</span>
                            <Textarea name="schedule_summary" required maxLength={2_000} defaultValue={classControl.scheduleSummary} className="min-h-20 border-zinc-700 bg-zinc-900" />
                        </label>
                        {!isOnline && (
                            <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                                <span>Үндсэн танхимын байршил *</span>
                                <Textarea name="location" required maxLength={1_000} defaultValue={classControl.location} className="min-h-20 border-zinc-700 bg-zinc-900" />
                            </label>
                        )}

                        <div className="space-y-4 md:col-span-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div><p className="font-semibold">Хичээлийн цагууд *</p><p className="mt-1 text-xs text-zinc-500">Устгах эсвэл нэмэхээс өмнө суралцагчдад үзүүлэх шинэ жагсаалтаа бүрэн шалгана.</p></div>
                                <Button type="button" variant="outline" onClick={() => setSessions((rows) => [...rows, {
                                    key: crypto.randomUUID(), id: '', title: '', startsAt: '', endsAt: '', meetingUrl: null, location: '',
                                }])}><Plus className="mr-2 h-4 w-4" />Цаг нэмэх</Button>
                            </div>
                            {sessions.map((session, index) => (
                                <div key={session.key} className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-2">
                                    <div className="flex items-center justify-between md:col-span-2">
                                        <strong className="text-sm">{index + 1}-р хичээл</strong>
                                        {sessions.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setSessions((rows) => rows.filter((row) => row.key !== session.key))} className="text-red-300"><Trash2 className="mr-2 h-4 w-4" />Хасах</Button>}
                                    </div>
                                    <label className="space-y-2 text-sm text-zinc-300 md:col-span-2"><span>Хичээлийн нэр *</span><Input name="session_title" required maxLength={160} defaultValue={session.title} className="border-zinc-700 bg-zinc-950" /></label>
                                    <label className="space-y-2 text-sm text-zinc-300"><span>Эхлэх цаг *</span><Input name="session_starts_at" type="datetime-local" required defaultValue={session.startsAt ? academyDateTimeInput(session.startsAt) : ''} className="border-zinc-700 bg-zinc-950" /></label>
                                    <label className="space-y-2 text-sm text-zinc-300"><span>Дуусах цаг *</span><Input name="session_ends_at" type="datetime-local" required defaultValue={session.endsAt ? academyDateTimeInput(session.endsAt) : ''} className="border-zinc-700 bg-zinc-950" /></label>
                                    {isOnline ? (
                                        <label className="space-y-2 text-sm text-zinc-300 md:col-span-2"><span>Онлайн уулзалтын холбоос *</span><Input name="session_meeting_url" type="url" required defaultValue={session.meetingUrl ?? ''} placeholder="https://meet.google.com/..." className="border-zinc-700 bg-zinc-950" /></label>
                                    ) : (
                                        <label className="space-y-2 text-sm text-zinc-300 md:col-span-2"><span>Энэ цагийн өөр байршил</span><Input name="session_location" defaultValue={session.location && session.location !== classControl.location ? session.location : ''} placeholder="Хоосон бол үндсэн байршлыг ашиглана" className="border-zinc-700 bg-zinc-950" /></label>
                                    )}
                                    {isOnline ? <input type="hidden" name="session_location" value="" /> : <input type="hidden" name="session_meeting_url" value="" />}
                                </div>
                            ))}
                            {sessions.length === 0 && <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">Дор хаяж нэг хичээлийн цаг шаардлагатай.</p>}
                        </div>

                        <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                            <span>Яагаад өөрчилж байгаа вэ? *</span>
                            <Textarea name="reason" required minLength={5} maxLength={500} placeholder="Жишээ: Багшийн хүсэлтээр 9-р сарын 5-ны хичээлийг нэг цагаар хойшлуулав." className="min-h-24 border-zinc-700 bg-zinc-900" />
                            <span className="block text-xs text-zinc-500">Энэ тайлбар түүхэнд хадгалагдаж, суралцагчийн и-мэйлд орно.</span>
                        </label>

                        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100 md:col-span-2">
                            <strong>{classControl.activeEnrollmentCount} идэвхтэй суралцагчид нөлөөлнө.</strong>
                            <p className="mt-1 text-amber-100/80">Хадгалсны дараа шинэ хуваарь шууд “Миний хичээлүүд” хэсэгт харагдаж, и-мэйл мэдэгдэл илгээгдэнэ.</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
                            <Button asChild type="button" variant="outline"><Link href={`/admin/classes/${classControl.id}`}>Болих</Link></Button>
                            <Button type="submit" disabled={pending || sessions.length === 0 || hasStartedSession || teachers.length === 0}>{pending ? 'Хадгалж байна…' : 'Хуваарь хадгалах'}</Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
