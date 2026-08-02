import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock3, MessageSquareText } from 'lucide-react'
import { getMyQuestions } from '@/features/qa/actions/qa-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default async function StudentQuestionsPage() {
    const questions = await getMyQuestions()

    return (
        <div className="mx-auto max-w-5xl p-6 md:p-8">
            <header className="mb-8">
                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
                        <MessageSquareText className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Миний асуултууд</h1>
                        <p className="mt-1 text-sm text-zinc-400">Хичээл дээр илгээсэн асуулт болон багийн хариултыг нэг дороос харна.</p>
                    </div>
                </div>
            </header>

            {questions.length === 0 ? (
                <Card className="border-zinc-800 bg-zinc-900/50 text-center">
                    <CardContent className="p-12">
                        <MessageSquareText className="mx-auto mb-4 h-11 w-11 text-zinc-600" />
                        <h2 className="text-lg font-semibold text-white">Одоогоор асуулт алга</h2>
                        <p className="mt-2 text-sm text-zinc-400">Хичээл үзэж байхдаа баруун талын “Асуулт, хариулт” хэсгээс асуултаа илгээнэ үү.</p>
                        <Button asChild className="mt-6 bg-indigo-600 text-white hover:bg-indigo-500">
                            <Link href="/dashboard/courses">Миний хичээлүүд рүү очих</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {questions.map((question) => {
                        const canOpenLesson = question.course && question.lesson

                        return (
                            <Card key={question.id} className="border-zinc-800 bg-zinc-900/70 text-white">
                                <CardContent className="p-5 md:p-6">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <Badge variant="outline" className={question.isAnswered ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-amber-500/30 bg-amber-500/5 text-amber-400'}>
                                                    {question.isAnswered ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                                                    {question.isAnswered ? 'Хариулсан' : 'Хариу хүлээж буй'}
                                                </Badge>
                                                <span className="text-xs text-zinc-500" suppressHydrationWarning>{new Date(question.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm font-medium text-indigo-300">{question.course?.title ?? 'Хичээл'}</p>
                                            <p className="mt-1 text-xs text-zinc-500">{question.lesson?.title ?? 'Хичээл'}</p>
                                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{question.content}</p>
                                        </div>

                                        {canOpenLesson && (
                                            <Button asChild variant="outline" className="shrink-0 border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800 hover:text-white">
                                                <Link href={`/courses/${question.courseId}?lesson=${question.lessonId}`}>
                                                    Хичээл рүү очих <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                            </Button>
                                        )}
                                    </div>

                                    {question.answers.length > 0 && (
                                        <div className="mt-5 space-y-3 border-t border-zinc-800 pt-5">
                                            {question.answers.map((answer) => (
                                                <div key={answer.id} className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <span className="text-sm font-semibold text-indigo-200">Mind Academy</span>
                                                        <span className="text-xs text-indigo-200/60" suppressHydrationWarning>{new Date(answer.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-100">{answer.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
