import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getAdminCohortApplications } from '@/features/admin/actions/cohort-application-actions.admin'
import { CohortApplicationInbox } from '@/features/admin/components/cohort-application-inbox'

export default async function AdminApplicationsPage() {
    const { applications, variableLabels } = await getAdminCohortApplications()

    return (
        <div className="space-y-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Түүхэн мэдээлэл</p>
                    <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Хуучин элсэлтийн хүсэлтүүд</h1>
                    <p className="mt-2 max-w-3xl text-zinc-400">Энэ хэсэг зөвхөн хуучин ангиудын бүртгэлд зориулагдсан. Шинэ ангиудын QPay элсэлт автоматаар баталгаажна.</p>
                </div>
                <Button asChild variant="outline" className="border-zinc-700 bg-zinc-950 text-white hover:bg-zinc-900">
                    <Link href="/admin/attention">Одоогийн ажлаа харах</Link>
                </Button>
            </div>
            <CohortApplicationInbox applications={applications} variableLabels={variableLabels} />
        </div>
    )
}
