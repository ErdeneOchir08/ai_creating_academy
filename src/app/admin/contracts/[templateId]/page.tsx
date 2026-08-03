import { notFound } from 'next/navigation'
import { getContractTemplate, getContractVariables } from '@/features/admin/actions/contract-actions.admin'
import { ContractTemplateEditor } from '@/features/admin/components/contract-template-editor'

export default async function AdminContractTemplatePage({ params }: { params: Promise<{ templateId: string }> }) {
    const { templateId } = await params
    const [template, variables] = await Promise.all([
        getContractTemplate(templateId),
        getContractVariables(),
    ])

    if (!template) notFound()
    return <ContractTemplateEditor template={template} variables={variables} />
}
