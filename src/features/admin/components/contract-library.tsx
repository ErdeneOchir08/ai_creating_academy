'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Archive, FilePlus2, FileSignature, PencilLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createContractTemplate, type ContractTemplateSummary, type ContractVersion } from '@/features/admin/actions/contract-actions.admin'

const statusLabels = {
    draft: 'Ноорог',
    published: 'Нийтлэгдсэн',
    retired: 'Ашиглалтаас гарсан',
} as const

function statusClass(status: ContractVersion['status']) {
    if (status === 'published') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    if (status === 'draft') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    return 'border-zinc-700 bg-zinc-900 text-zinc-400'
}

export function ContractLibrary({ templates }: { templates: ContractTemplateSummary[] }) {
    const router = useRouter()
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState('')

    async function createTemplate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')
        setIsCreating(true)
        try {
            const result = await createContractTemplate(new FormData(event.currentTarget))
            router.push(`/admin/contracts/${result.templateId}`)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Гэрээний сан үүсгэж чадсангүй.')
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-5 sm:p-8">
            <header>
                <div className="flex items-center gap-3">
                    <FileSignature className="h-7 w-7 text-indigo-400" />
                    <h1 className="text-2xl font-bold text-white sm:text-3xl">Гэрээний сан</h1>
                </div>
                <p className="mt-2 max-w-3xl text-zinc-400">
                    Батлагдсан гэрээний эхийг хувилбараар удирдана. Нийтэлсэн хувилбар өөрчлөгдөхгүй бөгөөд шинэчлэл бүр шинэ хувилбар болно.
                </p>
            </header>

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-indigo-400" />Шинэ гэрээний сан</CardTitle>
                    <CardDescription className="text-zinc-500">Эхлээд сан болон анхны ноорог хувилбарыг үүсгэнэ. Агуулгыг дараагийн дэлгэц дээр оруулна.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={createTemplate} className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span>Сангийн нэр</span>
                            <Input name="name" required maxLength={160} placeholder="Жишээ: TeenCoder сургалтын гэрээ" className="border-zinc-700 bg-zinc-900" />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                            <span>Баримт бичгийн гарчиг</span>
                            <Input name="title" required maxLength={240} placeholder="Жишээ: Сургалтын үйлчилгээ үзүүлэх гэрээ" className="border-zinc-700 bg-zinc-900" />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                            <span>Сангийн тайлбар</span>
                            <Textarea name="description" maxLength={1_000} placeholder="Ямар хөтөлбөр, нөхцөлд ашиглахыг тайлбарлана уу." className="min-h-24 border-zinc-700 bg-zinc-900" />
                        </label>
                        <input type="hidden" name="content" value="" />
                        <input type="hidden" name="change_summary" value="" />
                        <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center md:justify-between">
                            {error ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : <span />}
                            <Button disabled={isCreating} className="bg-indigo-600 text-white hover:bg-indigo-700">
                                <FilePlus2 className="mr-2 h-4 w-4" />{isCreating ? 'Үүсгэж байна…' : 'Ноорог үүсгэх'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-white">Бүртгэлтэй гэрээнүүд</h2>
                        <p className="mt-1 text-sm text-zinc-500">Нийт {templates.length} гэрээний сан байна.</p>
                    </div>
                </div>

                {templates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">Одоогоор гэрээний сан үүсгээгүй байна.</div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {templates.map((template) => {
                            const latest = template.versions[0]
                            const published = template.versions.find((version) => version.status === 'published')
                            return (
                                <Card key={template.id} className="border-zinc-800 bg-zinc-950 text-white">
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <CardTitle className="truncate text-lg">{template.name}</CardTitle>
                                                <CardDescription className="mt-2 line-clamp-2 text-zinc-500">{template.description || 'Тайлбар оруулаагүй.'}</CardDescription>
                                            </div>
                                            {template.is_archived && <Badge variant="outline" className="border-zinc-700 text-zinc-400"><Archive className="mr-1 h-3 w-3" />Архив</Badge>}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {latest && <Badge variant="outline" className={statusClass(latest.status)}>{statusLabels[latest.status]} · v{latest.version_number}</Badge>}
                                            {published && latest?.id !== published.id && <Badge variant="outline" className={statusClass('published')}>Идэвхтэй · v{published.version_number}</Badge>}
                                            <Badge variant="outline" className="border-zinc-800 text-zinc-500">{template.versions.length} хувилбар</Badge>
                                        </div>
                                        <Button asChild variant="outline" className="w-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800">
                                            <Link href={`/admin/contracts/${template.id}`}><PencilLine className="mr-2 h-4 w-4" />Удирдах</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
