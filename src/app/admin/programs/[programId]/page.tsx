import { notFound } from 'next/navigation'
import {
    getPublishedContractOptions,
    getOfferingCourseOptions,
    getTrainingProgram,
} from '@/features/admin/actions/training-program-actions.admin'
import { TrainingProgramEditor } from '@/features/admin/components/training-program-editor'

export default async function AdminTrainingProgramPage({ params }: { params: Promise<{ programId: string }> }) {
    const { programId } = await params
    const [program, contracts, courses] = await Promise.all([
        getTrainingProgram(programId),
        getPublishedContractOptions(),
        getOfferingCourseOptions(),
    ])
    if (!program) notFound()
    return <TrainingProgramEditor program={program} contracts={contracts} courses={courses} />
}
