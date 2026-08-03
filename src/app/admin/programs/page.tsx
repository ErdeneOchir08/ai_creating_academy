import { getTrainingProgramSummaries } from '@/features/admin/actions/training-program-actions.admin'
import { TrainingProgramLibrary } from '@/features/admin/components/training-program-library'

export default async function AdminProgramsPage() {
    const programs = await getTrainingProgramSummaries()
    return <TrainingProgramLibrary programs={programs} />
}
