'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    answersFromFormData,
    parseCohortApplicationForm,
    parseOpenCohorts,
} from '@/features/programs/domain/cohort-application'

function assertUuid(value: string, fieldName: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`${fieldName} буруу байна.`)
    }
}
function refreshApplication(cohortId: string) {
    revalidatePath('/programs')
    revalidatePath(`/programs/${cohortId}`)
}

export async function getOpenTrainingCohorts() {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('list_open_training_cohorts')

    if (error) {
        console.error('Unable to load open training cohorts:', error.message)
        throw new Error('Нээлттэй элсэлтүүдийг уншиж чадсангүй.')
    }
    return parseOpenCohorts(data ?? [])
}

export async function getOpenCohortApplicationForm(cohortId: string) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_open_cohort_application_form', { p_cohort_id: cohortId })

    if (error) {
        console.error('Unable to load cohort application form:', error.message)
        throw new Error('Элсэлтийн мэдээллийг уншиж чадсангүй.')
    }
    return data ? parseCohortApplicationForm(data) : null
}

async function saveDraft(cohortId: string, formData: FormData) {
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Өргөдөл гаргахын тулд нэвтэрнэ үү.')

    const answers = answersFromFormData(formData)
    const { data, error } = await supabase.rpc('save_cohort_application_draft', {
        p_cohort_id: cohortId,
        p_answers: answers,
    })

    if (error || !data) {
        console.error('Unable to save cohort application draft:', error?.message)
        throw new Error(error?.message.includes('not accepting')
            ? 'Энэ элсэлт одоогоор өргөдөл хүлээн авахгүй байна.'
            : 'Өргөдлийн нооргийг хадгалж чадсангүй.')
    }
    return data as string
}

export async function saveCohortApplicationDraft(cohortId: string, formData: FormData) {
    await saveDraft(cohortId, formData)
    refreshApplication(cohortId)
    return { success: 'Өргөдлийн ноорог хадгалагдлаа.' }
}

export async function submitCohortApplication(cohortId: string, formData: FormData) {
    const applicationId = await saveDraft(cohortId, formData)
    const supabase = await createClient()
    const { error } = await supabase.rpc('submit_cohort_application', { p_application_id: applicationId })

    if (error) {
        console.error('Unable to submit cohort application:', error.message)
        throw new Error(error.message.includes('missing')
            ? 'Гэрээнд шаардагдах бүх мэдээллийг бүрэн оруулна уу.'
            : 'Өргөдлийг илгээж чадсангүй.')
    }

    refreshApplication(cohortId)
    revalidatePath('/admin/applications')
    return { success: 'Өргөдөл амжилттай илгээгдлээ.' }
}

export async function withdrawCohortApplication(applicationId: string, cohortId: string) {
    assertUuid(applicationId, 'Өргөдлийн дугаар')
    assertUuid(cohortId, 'Элсэлтийн дугаар')
    const supabase = await createClient()
    const { error } = await supabase.rpc('withdraw_cohort_application', { p_application_id: applicationId })
    if (error) throw new Error('Өргөдлийг буцаан татаж чадсангүй.')

    refreshApplication(cohortId)
    revalidatePath('/admin/applications')
    return { success: 'Өргөдлийг буцаан татлаа.' }
}
