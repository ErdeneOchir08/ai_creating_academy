'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Archive, CalendarRange, Plus, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    createTrainingProgram,
    type TrainingProgramSummary,
} from '@/features/admin/actions/training-program-actions.admin'

export function TrainingProgramLibrary({ programs }: { programs: TrainingProgramSummary[] }) {
    const router = useRouter()
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState('')

    async function createProgram(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setIsCreating(true)
        try {
            const result = await createTrainingProgram(new FormData(event.currentTarget))
            router.push(`/admin/programs/${result.programId}`)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Сургалт үүсгэж чадсангүй.')
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8">
            <header>
                <div className="flex items-center gap-3">
                    <CalendarRange className="h-7 w-7 text-indigo-400" />
                    <h1 className="text-2xl font-bold text-white sm:text-3xl">Сургалтууд</h1>
                </div>
                <p className="mt-2 max-w-3xl text-zinc-400">
                    TeenCoder зэрэг сургалтын ерөнхий мэдээлэл, контент болон анги / элсэлтүүдийг нэг дор удирдана.
                </p>
            </header>

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-indigo-400" />Шинэ сургалт</CardTitle>
                    <CardDescription className="text-zinc-500">Сургалтын тогтвортой нэр, зорилгыг эхлээд үүсгэнэ. Дараа нь контент сонгож, анги / элсэлт нээнэ.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={createProgram} className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span>Сургалтын нэр</span>
                            <Input name="name" required maxLength={160} placeholder="Жишээ: TeenCoder" className="border-zinc-700 bg-zinc-900" />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                            <span>Тайлбар</span>
                            <Textarea name="description" maxLength={2_000} placeholder="Зорилтот суралцагч, сургалтын үндсэн зорилгыг бичнэ үү." className="min-h-24 border-zinc-700 bg-zinc-900" />
                        </label>
                        <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center md:justify-between">
                            {error ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : <span />}
                            <Button disabled={isCreating} className="bg-indigo-600 text-white hover:bg-indigo-700">
                                <Plus className="mr-2 h-4 w-4" />{isCreating ? 'Үүсгэж байна…' : 'Сургалт үүсгэх'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-white">Бүртгэлтэй сургалтууд</h2>
                    <p className="mt-1 text-sm text-zinc-500">Нийт {programs.length} сургалт байна.</p>
                </div>
                {programs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">Одоогоор сургалт үүсгээгүй байна.</div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {programs.map((program) => (
                            <Card key={program.id} className="border-zinc-800 bg-zinc-950 text-white">
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <CardTitle className="truncate text-lg">{program.name}</CardTitle>
                                            <CardDescription className="mt-2 line-clamp-2 text-zinc-500">{program.description || 'Тайлбар оруулаагүй.'}</CardDescription>
                                        </div>
                                        {program.is_archived && <Badge variant="outline" className="border-zinc-700 text-zinc-400"><Archive className="mr-1 h-3 w-3" />Архив</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">{program.cohortCount} анги / элсэлт</Badge>
                                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{program.openCohortCount} нээлттэй</Badge>
                                    </div>
                                    <Button asChild variant="outline" className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800">
                                        <Link href={`/admin/programs/${program.id}`}><Settings2 className="mr-2 h-4 w-4" />Сургалтыг удирдах</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
