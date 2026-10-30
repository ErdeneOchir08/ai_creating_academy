'use client'

import { useLocale, useTranslations } from '@/components/language-provider'
import { formatAcademyDateTime } from '@/lib/i18n/format'
import { CalendarDays, ExternalLink, MapPin, UserRound, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MyClassSchedule } from '@/features/dashboard/actions/dashboard-actions'

export function MyClassScheduleList({ schedules, serverNow }: { schedules: MyClassSchedule[]; serverNow: string }) {
    const t = useTranslations()
    const locale = useLocale()

    if (schedules.length === 0) return null
    const now = new Date(serverNow).getTime()

    return (
        <section className="mb-12">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-white"><CalendarDays className="h-5 w-5 text-indigo-400" />{t("Миний ангийн хуваарь")}</h2>
                    <p className="mt-1 text-sm text-zinc-400">{t("Багштай хичээлийн цаг, холбоос болон байршил.")}</p>
                </div>
                <Badge className="bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/10">{schedules.length} {t("анги")}</Badge>
            </div>
            <div className="space-y-5">
                {schedules.map((schedule) => (
                    <Card key={schedule.classId} className="border-zinc-800 bg-zinc-950 text-white">
                        <CardHeader>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <CardTitle>{schedule.className}</CardTitle>
                                    <CardDescription className="mt-2 flex items-center gap-2 text-zinc-400"><UserRound className="h-4 w-4" />{schedule.teacherName}</CardDescription>
                                </div>
                                <Badge variant="outline" className="border-zinc-700 text-zinc-300">{schedule.classType === 'instructor_led_online' ? t("Онлайн · багштай") : t("Танхим + видео")}</Badge>
                            </div>
                            {schedule.scheduleSummary && <p className="pt-2 text-sm text-zinc-400">{schedule.scheduleSummary}</p>}
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {schedule.sessions.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">{t("Нарийн хичээлийн цаг удахгүй нэмэгдэнэ.")}</p>
                            ) : schedule.sessions.map((session) => {
                                const finished = new Date(session.endsAt).getTime() < now
                                return (
                                    <div key={session.id} className={`grid gap-4 rounded-xl border p-4 md:grid-cols-[1fr_auto] md:items-center ${finished ? 'border-zinc-900 bg-zinc-950 opacity-60' : 'border-zinc-800 bg-zinc-900/50'}`}>
                                        <div>
                                            <p className="font-medium text-white">{session.title}</p>
                                            <p className="mt-1 text-sm text-zinc-400">{formatAcademyDateTime(session.startsAt, locale)} – {formatAcademyDateTime(session.endsAt, locale)}</p>
                                            {session.location && <p className="mt-2 flex items-start gap-2 text-sm text-zinc-300"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />{session.location}</p>}
                                        </div>
                                        {session.meetingUrl && !finished && (
                                            <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
                                                <a href={session.meetingUrl} target="_blank" rel="noreferrer"><Video className="mr-2 h-4 w-4" />{t("Онлайн хичээлд орох")}<ExternalLink className="ml-2 h-3.5 w-3.5" /></a>
                                            </Button>
                                        )}
                                    </div>
                                )
                            })}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    )
}

