'use client'

import { useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createCategory, deleteCategory, updateCategory } from '@/features/admin/actions/category-actions.admin'

type Category = { id: string; name: string; position: number; is_visible: boolean }

export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
    const [name, setName] = useState('')
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [error, setError] = useState('')

    async function addCategory(event: React.FormEvent) {
        event.preventDefault()
        if (!name.trim()) return
        setError('')
        setPendingId('new')
        try {
            const data = new FormData()
            data.set('name', name)
            await createCategory(data)
            setName('')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not create the category.')
        } finally {
            setPendingId(null)
        }
    }

    async function saveCategory(category: Category, form: HTMLFormElement) {
        setError('')
        setPendingId(category.id)
        try {
            await updateCategory(category.id, new FormData(form))
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save the category.')
        } finally {
            setPendingId(null)
        }
    }

    async function removeCategory(category: Category) {
        if (!confirm(`“${category.name}” ангиллыг устгах уу? Хичээлүүд устахгүй, зөвхөн ангиллаас сална.`)) return
        setError('')
        setPendingId(category.id)
        try {
            await deleteCategory(category.id)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not delete the category.')
        } finally {
            setPendingId(null)
        }
    }

    return <div className="mx-auto max-w-3xl space-y-8 p-5 sm:p-8">
        <header>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Хичээлийн ангиллууд</h1>
            <p className="mt-2 text-zinc-400">Эхлээд ангиллаа үүсгэнэ. Дараагийн алхамд хичээл бүрт нэг эсвэл олон ангилал сонгоно.</p>
        </header>
        <form onSubmit={addCategory} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Жишээ: AI, Программчлал, Хүүхэд" className="border-zinc-700 bg-zinc-900" />
            <Button disabled={pendingId === 'new'} className="shrink-0 bg-indigo-600 text-white hover:bg-indigo-700"><Plus className="mr-2 h-4 w-4" />Нэмэх</Button>
        </form>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <div className="space-y-3">
            {initialCategories.map((category) => <form key={category.id} onSubmit={(event) => { event.preventDefault(); void saveCategory(category, event.currentTarget) }} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center">
                <Input name="name" defaultValue={category.name} maxLength={60} className="border-zinc-700 bg-zinc-900" />
                <label className="flex items-center gap-2 text-sm text-zinc-300"><input name="is_visible" type="checkbox" value="true" defaultChecked={category.is_visible} className="h-4 w-4 accent-indigo-500" />{category.is_visible ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-zinc-500" />}Нийтэд харагдана</label>
                <div className="flex gap-2 sm:ml-auto"><Button type="submit" variant="outline" disabled={pendingId === category.id}>Хадгалах</Button><Button type="button" variant="ghost" size="icon" disabled={pendingId === category.id} onClick={() => void removeCategory(category)} className="text-zinc-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button></div>
            </form>)}
            {initialCategories.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">Одоогоор ангилал байхгүй байна.</p>}
        </div>
    </div>
}
