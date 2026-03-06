import { getStudentProjects } from '@/features/admin/actions/project-actions.admin'
import { getAllAdminCourses } from '@/features/admin/actions/course-actions.admin'
import { AdminProjectsClient } from '@/app/admin/projects/admin-projects-client'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
    title: 'Student Showcase - Admin Portal',
}

export default async function AdminProjectsPage() {
    const supabase = await createClient()

    // Ensure user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') redirect('/dashboard')

    const [projects, courses] = await Promise.all([
        getStudentProjects(),
        getAllAdminCourses()
    ])

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Student Showcase</h1>
                <p className="text-zinc-400">Manage the student projects that appear on your landing page auto-slider to build social proof.</p>
            </div>

            <AdminProjectsClient initialProjects={projects} courses={courses} />
        </div>
    )
}
