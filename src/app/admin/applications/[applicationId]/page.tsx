import { notFound } from 'next/navigation'
import { getAdminCohortApplicationSnapshot } from '@/features/admin/actions/cohort-application-actions.admin'
import { ContractSnapshotAudit } from '@/features/admin/components/contract-snapshot-audit'

export default async function AdminApplicationSnapshotPage({
    params,
}: {
    params: Promise<{ applicationId: string }>
}) {
    const { applicationId } = await params
    const { snapshot, variableLabels } = await getAdminCohortApplicationSnapshot(applicationId)

    if (!snapshot) notFound()

    return <ContractSnapshotAudit snapshot={snapshot} variableLabels={variableLabels} />
}
