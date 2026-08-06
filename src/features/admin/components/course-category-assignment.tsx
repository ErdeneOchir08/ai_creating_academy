'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { setCourseCategories } from '@/features/admin/actions/category-actions.admin'

type Category = { id: string; name: string; is_visible: boolean }

export function CourseCategoryAssignment({ courseId, categories, initialCategoryIds }: { courseId: string; categories: Category[]; initialCategoryIds: string[] }) {
    const [selected, setSelected] = useState(new Set(initialCategoryIds))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    async function save() {
        setSaving(true); setError('')
        try { await setCourseCategories(courseId, [...selected]) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Ангиллыг хадгалж чадсангүй.') }
        finally { setSaving(false) }
    }
    return <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div><h3 className="font-semibold text-white">Ангиллууд</h3><p className="text-xs text-zinc-500">Энэ хичээл нэгээс олон ангилалд байж болно.</p></div>
        {categories.length ? <div className="space-y-2">{categories.map((category) => <label key={category.id} className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={selected.has(category.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(category.id)) { next.delete(category.id) } else { next.add(category.id) } return next })} className="h-4 w-4 accent-indigo-500" />{category.name}{!category.is_visible && <span className="text-xs text-zinc-500">(далд)</span>}</label>)}</div> : <p className="text-sm text-zinc-500">Эхлээд Ангиллууд хэсгээс ангилал үүсгэнэ үү.</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button type="button" onClick={() => void save()} disabled={saving} className="w-full bg-indigo-600 text-white hover:bg-indigo-700">{saving ? 'Хадгалж байна...' : 'Ангиллыг хадгалах'}</Button>
    </div>
}
