'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getStudentProjects() {
    const supabase = await createClient()

    const { data: projects, error } = await supabase
        .from('student_projects')
        .select(`
            *,
            courses(title)
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching student projects:', error)
        return []
    }

    return projects
}

export async function adminCreateStudentProject(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const student_name = formData.get('student_name') as string
    const project_title = formData.get('project_title') as string
    const image_url = formData.get('image_url') as string
    const course_id = formData.get('course_id') as string | null

    const { error } = await supabase
        .from('student_projects')
        .insert([{
            student_name,
            project_title,
            image_url,
            course_id: course_id ? course_id : null
        }])

    if (error) {
        console.error('Error creating student project:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/projects')
    revalidatePath('/') // Revalidate the home landing page
    return { success: true }
}

export async function adminDeleteStudentProject(projectId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('student_projects')
        .delete()
        .eq('id', projectId)

    if (error) {
        console.error('Error deleting student project:', error)
        throw new Error('Failed to delete project')
    }

    revalidatePath('/admin/projects')
    revalidatePath('/') // Revalidate the home landing page
    return { success: true }
}
