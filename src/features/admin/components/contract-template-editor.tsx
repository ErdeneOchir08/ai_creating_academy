'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { Archive, ArchiveRestore, Copy, FilePlus2, Save, Send, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    createNextContractDraft,
    deleteContractDraft,
    deleteDraftContractTemplate,
    publishContractVersion,
    retireContractVersion,
    setContractTemplateArchived,
    updateContractDraft,
    updateContractTemplateMetadata,
    type ContractTemplate,
    type ContractVariable,
    type ContractVersion,
} from '@/features/admin/actions/contract-actions.admin'

const categoryLabels: Record<ContractVariable['category'], string> = {
    contract: 'Гэрээ',
    participant: 'Оролцогч',
    program: 'Хөтөлбөр',
    payment: 'Төлбөр',
    academy: 'Академи',
}

const statusLabels = { draft: 'Ноорог', published: 'Нийтлэгдсэн', retired: 'Ашиглалтаас гарсан' } as const

function VersionBadge({ status }: { status: ContractVersion['status'] }) {
    const className = status === 'published'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : status === 'draft'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : 'border-zinc-700 bg-zinc-900 text-zinc-400'
    return <Badge variant="outline" className={className}>{statusLabels[status]}</Badge>
}

export function ContractTemplateEditor({ template, variables }: { template: ContractTemplate; variables: ContractVariable[] }) {
    const router = useRouter()
    const draft = template.versions.find((version) => version.status === 'draft')
    const published = template.versions.find((version) => version.status === 'published')
    const [content, setContent] = useState(draft?.content ?? published?.content ?? '')
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const groupedVariables = useMemo(() => variables.reduce<Record<string, ContractVariable[]>>((groups, variable) => {
        groups[variable.category] = [...(groups[variable.category] ?? []), variable]
        return groups
    }, {}), [variables])

    async function run(actionName: string, action: () => Promise<void>, successMessage: string) {
        setError('')
        setMessage('')
        setPendingAction(actionName)
        try {
            await action()
            setMessage(successMessage)
            router.refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Үйлдлийг гүйцэтгэж чадсангүй.')
        } finally {
            setPendingAction(null)
        }
    }

    function insertVariable(variableKey: string) {
        if (!draft || !textareaRef.current) return
        const token = `{{${variableKey}}}`
        const textarea = textareaRef.current
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const next = `${content.slice(0, start)}${token}${content.slice(end)}`
        setContent(next)
        requestAnimationFrame(() => {
            textarea.focus()
            textarea.setSelectionRange(start + token.length, start + token.length)
        })
    }

    async function saveMetadata(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        await run('metadata', () => updateContractTemplateMetadata(template.id, formData), 'Сангийн мэдээллийг хадгаллаа.')
    }

    async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!draft) return
        const formData = new FormData(event.currentTarget)
        formData.set('content', content)
        await run('draft', () => updateContractDraft(draft.id, formData), 'Ноорог хувилбарыг хадгаллаа.')
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-bold text-white sm:text-3xl">{template.name}</h1>
                        {template.is_archived && <Badge variant="outline" className="border-zinc-700 text-zinc-400"><Archive className="mr-1 h-3 w-3" />Архив</Badge>}
                    </div>
                    <p className="mt-2 text-zinc-400">Гэрээний эх, хувьсагч болон нийтлэгдсэн хувилбарын түүхийг удирдана.</p>
                </div>
                <Button
                    variant="outline"
                    disabled={pendingAction !== null}
                    onClick={() => void run('archive', () => setContractTemplateArchived(template.id, !template.is_archived), template.is_archived ? 'Гэрээний санг архиваас гаргалаа.' : 'Гэрээний санг архивлалаа.')}
                    className="border-zinc-700 bg-zinc-950"
                >
                    {template.is_archived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                    {template.is_archived ? 'Архиваас гаргах' : 'Архивлах'}
                </Button>
            </header>

            {(error || message) && <div className={error ? 'rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300' : 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300'}>{error || message}</div>}

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader><CardTitle>Сангийн мэдээлэл</CardTitle><CardDescription className="text-zinc-500">Энэ нэр, тайлбар нь зөвхөн админ удирдлагад ашиглагдана.</CardDescription></CardHeader>
                <CardContent>
                    <form onSubmit={saveMetadata} className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
                        <label className="space-y-2 text-sm text-zinc-300"><span>Сангийн нэр</span><Input name="name" required maxLength={160} defaultValue={template.name} className="border-zinc-700 bg-zinc-900" /></label>
                        <label className="space-y-2 text-sm text-zinc-300"><span>Тайлбар</span><Input name="description" maxLength={1_000} defaultValue={template.description} className="border-zinc-700 bg-zinc-900" /></label>
                        <Button disabled={pendingAction !== null} variant="outline" className="border-zinc-700"><Save className="mr-2 h-4 w-4" />Хадгалах</Button>
                    </form>
                </CardContent>
            </Card>

            {draft ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <Card className="border-zinc-800 bg-zinc-950 text-white">
                        <CardHeader>
                            <div className="flex flex-wrap items-center gap-3"><CardTitle>v{draft.version_number} ноорог</CardTitle><VersionBadge status="draft" /></div>
                            <CardDescription className="text-zinc-500">Нооргийг хэдэн ч удаа хадгалж болно. Нийтэлсний дараа агуулга түгжигдэнэ.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={saveDraft} className="space-y-4">
                                <label className="block space-y-2 text-sm text-zinc-300"><span>Баримт бичгийн гарчиг</span><Input name="title" required maxLength={240} defaultValue={draft.title} className="border-zinc-700 bg-zinc-900" /></label>
                                <label className="block space-y-2 text-sm text-zinc-300">
                                    <span>Гэрээний агуулга</span>
                                    <Textarea ref={textareaRef} name="content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={100_000} className="min-h-[520px] resize-y border-zinc-700 bg-zinc-900 font-mono text-sm leading-7" placeholder="Хуулийн болон удирдлагын хяналтаар баталгаажсан гэрээний эхийг оруулна уу." />
                                </label>
                                <label className="block space-y-2 text-sm text-zinc-300"><span>Энэ хувилбарын өөрчлөлтийн тайлбар</span><Textarea name="change_summary" maxLength={1_000} defaultValue={draft.change_summary} className="min-h-24 border-zinc-700 bg-zinc-900" /></label>
                                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                                    <Button type="button" variant="ghost" disabled={pendingAction !== null} onClick={() => {
                                        if (!confirm('Энэ ноорог хувилбарыг устгах уу?')) return
                                        void run('delete-draft', () => deleteContractDraft(draft.id, template.id), 'Ноорог хувилбарыг устгалаа.')
                                    }} className="text-zinc-400 hover:text-red-400"><Trash2 className="mr-2 h-4 w-4" />Ноорог устгах</Button>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Button disabled={pendingAction !== null} variant="outline" className="border-zinc-700"><Save className="mr-2 h-4 w-4" />Ноорог хадгалах</Button>
                                        <Button type="button" disabled={pendingAction !== null || template.is_archived} onClick={() => {
                                            if (!confirm('Энэ хувилбарыг нийтлэх үү? Нийтэлсний дараа агуулгыг засах боломжгүй.')) return
                                            void run('publish', () => publishContractVersion(draft.id), 'Гэрээний хувилбарыг нийтэллээ.')
                                        }} className="bg-emerald-600 hover:bg-emerald-700"><Send className="mr-2 h-4 w-4" />Нийтэлж түгжих</Button>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <aside className="space-y-4">
                        <Card className="border-zinc-800 bg-zinc-950 text-white">
                            <CardHeader><CardTitle className="text-base">Баталгаатай хувьсагчид</CardTitle><CardDescription className="text-zinc-500">Товчийг дарж курсорын байрлалд оруулна.</CardDescription></CardHeader>
                            <CardContent className="max-h-[660px] space-y-5 overflow-y-auto">
                                {Object.entries(groupedVariables).map(([category, items]) => <div key={category} className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{categoryLabels[category as ContractVariable['category']]}</p>
                                    <div className="space-y-2">{items.map((variable) => <button key={variable.key} type="button" onClick={() => insertVariable(variable.key)} title={variable.description_mn} className="flex w-full items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm hover:border-indigo-500/40 hover:bg-indigo-500/10">
                                        <span className="min-w-0"><span className="block truncate text-zinc-200">{variable.label_mn}</span><code className="text-xs text-indigo-400">{`{{${variable.key}}}`}</code></span><Copy className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                                    </button>)}</div>
                                </div>)}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            ) : (
                <Card className="border-zinc-800 bg-zinc-950 text-white">
                    <CardHeader><CardTitle>Засварлах ноорог байхгүй</CardTitle><CardDescription className="text-zinc-500">Нийтлэгдсэн эсвэл ашиглалтаас гарсан хамгийн сүүлийн хувилбараас шинэ ноорог үүсгэнэ.</CardDescription></CardHeader>
                    <CardContent><Button disabled={pendingAction !== null || template.is_archived} onClick={() => void run('new-draft', () => createNextContractDraft(template.id), 'Шинэ ноорог хувилбар үүсгэлээ.')} className="bg-indigo-600 hover:bg-indigo-700"><FilePlus2 className="mr-2 h-4 w-4" />Шинэ хувилбарын ноорог үүсгэх</Button></CardContent>
                </Card>
            )}

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader><CardTitle>Хувилбарын түүх</CardTitle><CardDescription className="text-zinc-500">Нийтлэгдсэн түүх устахгүй. Одоогийн нийтлэгдсэн хувилбарыг шаардлагатай үед ашиглалтаас гаргаж болно.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                    {template.versions.map((version) => <div key={version.id} className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-white">v{version.version_number} · {version.title}</span><VersionBadge status={version.status} /></div><p className="mt-1 text-sm text-zinc-500">{version.change_summary || 'Өөрчлөлтийн тайлбар оруулаагүй.'}</p></div>
                        {version.status === 'published' && <Button variant="outline" disabled={pendingAction !== null} onClick={() => {
                            if (!confirm('Энэ нийтлэгдсэн хувилбарыг ашиглалтаас гаргах уу?')) return
                            void run('retire', () => retireContractVersion(version.id, template.id), 'Гэрээний хувилбарыг ашиглалтаас гаргалаа.')
                        }} className="shrink-0 border-zinc-700"><Archive className="mr-2 h-4 w-4" />Ашиглалтаас гаргах</Button>}
                    </div>)}
                </CardContent>
            </Card>

            {template.versions.every((version) => version.status === 'draft') && (
                <div className="flex justify-end border-t border-zinc-800 pt-6">
                    <Button variant="ghost" disabled={pendingAction !== null} onClick={() => {
                        if (!confirm('Энэ гэрээний сан болон бүх нооргийг бүрэн устгах уу?')) return
                        void run('delete-template', async () => {
                            await deleteDraftContractTemplate(template.id)
                            router.push('/admin/contracts')
                        }, 'Гэрээний санг устгалаа.')
                    }} className="text-zinc-500 hover:text-red-400"><Trash2 className="mr-2 h-4 w-4" />Нийтлэгдээгүй санг устгах</Button>
                </div>
            )}
        </div>
    )
}
