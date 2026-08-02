'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Administrator access is required.')

    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (role?.role !== 'admin') throw new Error('Administrator access is required.')
    return supabase
}

function normalizeName(value: FormDataEntryValue | null) {
    const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
    if (!name || name.length > 60) throw new Error('Category name must be between 1 and 60 characters.')
    return name
}

function refreshCategories() {
    revalidatePath('/admin/categories')
    revalidatePath('/admin/courses')
    revalidatePath('/')
}

export async function getAdminCategories() {
    const supabase = await requireAdmin()
    const { data, error } = await supabase
        .from('course_categories')
        .select('id, name, position, is_visible')
        .order('position')
        .order('name')
    if (error) throw new Error(error.message)
    return data ?? []
}

export async function createCategory(formData: FormData) {
    const supabase = await requireAdmin()
    const name = normalizeName(formData.get('name'))
    const { data: lastCategory } = await supabase.from('course_categories').select('position').order('position', { ascending: false }).limit(1).maybeSingle()
    const { error } = await supabase.from('course_categories').insert({
        name,
        slug: `category-${crypto.randomUUID()}`,
        position: (lastCategory?.position ?? -1) + 1,
        is_visible: true,
    })
    if (error) throw new Error(error.code === '23505' ? 'A category with this name already exists.' : error.message)
    refreshCategories()
}

export async function updateCategory(id: string, formData: FormData) {
    const supabase = await requireAdmin()
    const name = normalizeName(formData.get('name'))
    const is_visible = formData.get('is_visible') === 'true'
    const { error } = await supabase.from('course_categories').update({ name, is_visible }).eq('id', id)
    if (error) throw new Error(error.code === '23505' ? 'A category with this name already exists.' : error.message)
    refreshCategories()
}

export async function deleteCategory(id: string) {
    const supabase = await requireAdmin()
    const { error } = await supabase.from('course_categories').delete().eq('id', id)
    if (error) throw new Error(error.message)
    refreshCategories()
}

export async function getCourseCategoryIds(courseId: string) {
    const supabase = await requireAdmin()
    const { data, error } = await supabase.from('course_category_assignments').select('category_id').eq('course_id', courseId)
    if (error) throw new Error(error.message)
    return (data ?? []).map(({ category_id }) => category_id)
}

export async function setCourseCategories(courseId: string, categoryIds: string[]) {
    const supabase = await requireAdmin()
    const selected = [...new Set(categoryIds.filter(Boolean))]
    const { data: existing, error: existingError } = await supabase.from('course_category_assignments').select('category_id').eq('course_id', courseId)
    if (existingError) throw new Error(existingError.message)
    const existingIds = new Set((existing ?? []).map(({ category_id }) => category_id))
    const toRemove = [...existingIds].filter((id) => !selected.includes(id))
    const toAdd = selected.filter((id) => !existingIds.has(id))
    if (toRemove.length) {
        const { error } = await supabase.from('course_category_assignments').delete().eq('course_id', courseId).in('category_id', toRemove)
        if (error) throw new Error(error.message)
    }
    if (toAdd.length) {
        const { error } = await supabase.from('course_category_assignments').insert(toAdd.map((category_id) => ({ course_id: courseId, category_id })))
        if (error) throw new Error(error.message)
    }
    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath('/')
}

export async function getCourseBonusIds(courseId: string) { const supabase = await requireAdmin(); const { data, error } = await supabase.from('course_bonus_courses').select('bonus_course_id').eq('source_course_id', courseId); if (error) throw new Error(error.message); return (data ?? []).map((row) => row.bonus_course_id) }
export async function setCourseBonuses(courseId: string, bonusIds: string[]) { const supabase = await requireAdmin(); const selected = [...new Set(bonusIds.filter((id) => id && id !== courseId))]; const { error: removeError } = await supabase.from('course_bonus_courses').delete().eq('source_course_id', courseId); if (removeError) throw new Error(removeError.message); if (selected.length) { const { error } = await supabase.from('course_bonus_courses').insert(selected.map((bonus_course_id) => ({ source_course_id: courseId, bonus_course_id }))); if (error) throw new Error(error.message) } revalidatePath(`/admin/courses/${courseId}`) }
