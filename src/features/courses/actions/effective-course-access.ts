import { createClient } from '@/lib/supabase/server'
import {
    parseEffectiveCourseAccessResult,
    parseEffectiveCourseAccessRows,
} from '../domain/effective-course-access'

type AcademySupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function getMyEffectiveCourseAccess(supabase: AcademySupabaseClient) {
    const { data, error } = await supabase.rpc('get_my_effective_course_access')

    if (error) {
        throw new Error(`Unable to load effective course access: ${error.message}`)
    }

    return parseEffectiveCourseAccessRows(data)
}

export async function hasEffectiveCourseAccess(
    supabase: AcademySupabaseClient,
    courseId: string,
) {
    const { data, error } = await supabase.rpc('has_effective_course_access', {
        p_course_id: courseId,
    })

    if (error) {
        throw new Error(`Unable to check effective course access: ${error.message}`)
    }

    return parseEffectiveCourseAccessResult(data)
}
