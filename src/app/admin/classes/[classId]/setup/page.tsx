import { notFound } from 'next/navigation'
import { getGuidedClassDraft, getTeacherOptions } from '@/features/admin/actions/guided-class-actions.admin'
import {
    getOfferingCourseOptions,
    getPublishedContractOptions,
} from '@/features/admin/actions/training-program-actions.admin'
import { GuidedClassWizard } from '@/features/admin/components/guided-class-wizard'
import { getQpayPublicState } from '@/lib/qpay/config'

export default async function GuidedClassSetupPage({
    params,
    searchParams,
}: {
    params: Promise<{ classId: string }>
    searchParams: Promise<{ step?: string }>
}) {
    const [{ classId }, { step }] = await Promise.all([params, searchParams])
    const [draft, courses, contracts, teachers] = await Promise.all([
        getGuidedClassDraft(classId),
        getOfferingCourseOptions(),
        getPublishedContractOptions(),
        getTeacherOptions(),
    ])
    if (!draft) notFound()

    const parsedStep = Number(step)
    const currentStep = Number.isInteger(parsedStep) && parsedStep >= 2 && parsedStep <= 5 ? parsedStep : 2
    return (
        <GuidedClassWizard
            draft={draft}
            currentStep={currentStep}
            courses={courses}
            contracts={contracts}
            teachers={teachers}
            qpay={getQpayPublicState()}
        />
    )
}
