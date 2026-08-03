import { getContractTemplateSummaries } from '@/features/admin/actions/contract-actions.admin'
import { ContractLibrary } from '@/features/admin/components/contract-library'

export default async function AdminContractsPage() {
    const templates = await getContractTemplateSummaries()
    return <ContractLibrary templates={templates} />
}
