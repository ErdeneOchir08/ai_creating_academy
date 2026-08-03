import { getAdminCohortApplications } from '@/features/admin/actions/cohort-application-actions.admin'
import { CohortApplicationInbox } from '@/features/admin/components/cohort-application-inbox'

export default async function AdminApplicationsPage() {
    const { applications, variableLabels } = await getAdminCohortApplications()

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white sm:text-4xl">Элсэлтийн өргөдлүүд</h1>
                <p className="mt-2 text-zinc-400">Хөтөлбөрийн өргөдлийг хянаж, зөвшөөрөх эсвэл шалтгаантайгаар буцаана.</p>
            </div>
            <CohortApplicationInbox applications={applications} variableLabels={variableLabels} />
        </div>
    )
}
