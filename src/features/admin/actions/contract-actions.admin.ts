'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    validateContractDraftInput,
    validatePublishableContract,
} from '@/features/contracts/domain/contract-template'

export type ContractStatus = 'draft' | 'published' | 'retired'

export type ContractVariable = {
    key: string
    label_mn: string
    description_mn: string
    category: 'contract' | 'participant' | 'program' | 'payment' | 'academy'
}

export type ContractVersion = {
    id: string
    template_id: string
    version_number: number
    status: ContractStatus
    title: string
    content: string
    change_summary: string
    created_at: string
    updated_at: string
    published_at: string | null
    retired_at: string | null
}

export type ContractVersionSummary = Omit<ContractVersion, 'content' | 'change_summary'>

export type ContractTemplate = {
    id: string
    name: string
    description: string
    is_archived: boolean
    created_at: string
    updated_at: string
    versions: ContractVersion[]
}

export type ContractTemplateSummary = Omit<ContractTemplate, 'versions'> & {
    versions: ContractVersionSummary[]
}

async function requireAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Админаар нэвтэрнэ үү.')

    const { data: role, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

    if (error || role?.role !== 'admin') throw new Error('Админы эрх шаардлагатай.')
    return { supabase, user }
}

function normalizeTemplateMetadata(formData: FormData) {
    const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ')
    const description = String(formData.get('description') ?? '').trim()
    if (!name || name.length > 160) throw new Error('Сангийн нэр 1–160 тэмдэгттэй байна.')
    if (description.length > 1_000) throw new Error('Тайлбар 1,000 тэмдэгтээс урт байж болохгүй.')
    return { name, description }
}

function versionInputFromForm(formData: FormData) {
    return {
        title: String(formData.get('title') ?? ''),
        content: String(formData.get('content') ?? ''),
        changeSummary: String(formData.get('change_summary') ?? ''),
    }
}

function assertUuid(value: string, fieldName: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error(`${fieldName} буруу байна.`)
    }
}

function refreshContracts(templateId?: string) {
    revalidatePath('/admin/contracts')
    if (templateId) revalidatePath(`/admin/contracts/${templateId}`)
}

async function getVariableKeys(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data, error } = await supabase
        .from('contract_variables')
        .select('key')
        .eq('is_active', true)

    if (error) throw new Error('Гэрээний хувьсагчдын бүртгэлийг уншиж чадсангүй.')
    return new Set((data ?? []).map((variable) => variable.key))
}

export async function getContractVariables(): Promise<ContractVariable[]> {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase
        .from('contract_variables')
        .select('key, label_mn, description_mn, category')
        .eq('is_active', true)
        .order('category')
        .order('key')

    if (error) throw new Error('Гэрээний хувьсагчдын бүртгэлийг уншиж чадсангүй.')
    return (data ?? []) as ContractVariable[]
}

export async function getContractTemplateSummaries(): Promise<ContractTemplateSummary[]> {
    const { supabase } = await requireAdmin()
    const [templatesResult, versionsResult] = await Promise.all([
        supabase
            .from('contract_templates')
            .select('id, name, description, is_archived, created_at, updated_at')
            .order('updated_at', { ascending: false }),
        supabase
            .from('contract_template_versions')
            .select('id, template_id, version_number, status, title, created_at, updated_at, published_at, retired_at')
            .order('version_number', { ascending: false }),
    ])

    if (templatesResult.error || versionsResult.error) {
        console.error('Unable to load contract library:', templatesResult.error?.message ?? versionsResult.error?.message)
        throw new Error('Гэрээний санг уншиж чадсангүй.')
    }

    const versionsByTemplate = new Map<string, ContractVersionSummary[]>()
    for (const version of (versionsResult.data ?? []) as ContractVersionSummary[]) {
        versionsByTemplate.set(version.template_id, [
            ...(versionsByTemplate.get(version.template_id) ?? []),
            version,
        ])
    }

    return (templatesResult.data ?? []).map((template) => ({
        ...template,
        versions: versionsByTemplate.get(template.id) ?? [],
    })) as ContractTemplateSummary[]
}

export async function getContractTemplate(templateId: string): Promise<ContractTemplate | null> {
    assertUuid(templateId, 'Гэрээний сангийн дугаар')
    const { supabase } = await requireAdmin()
    const [templateResult, versionsResult] = await Promise.all([
        supabase
            .from('contract_templates')
            .select('id, name, description, is_archived, created_at, updated_at')
            .eq('id', templateId)
            .maybeSingle(),
        supabase
            .from('contract_template_versions')
            .select('id, template_id, version_number, status, title, content, change_summary, created_at, updated_at, published_at, retired_at')
            .eq('template_id', templateId)
            .order('version_number', { ascending: false }),
    ])

    if (templateResult.error || versionsResult.error) {
        console.error('Unable to load contract template:', templateResult.error?.message ?? versionsResult.error?.message)
        throw new Error('Гэрээний санг уншиж чадсангүй.')
    }
    if (!templateResult.data) return null

    return {
        ...templateResult.data,
        versions: (versionsResult.data ?? []) as ContractVersion[],
    } as ContractTemplate
}

export async function createContractTemplate(formData: FormData) {
    const { supabase } = await requireAdmin()
    const metadata = normalizeTemplateMetadata(formData)
    const variableKeys = await getVariableKeys(supabase)
    const version = validateContractDraftInput(versionInputFromForm(formData), variableKeys)

    const { data, error } = await supabase.rpc('create_contract_template', {
        p_name: metadata.name,
        p_description: metadata.description,
        p_title: version.title,
        p_content: version.content,
        p_change_summary: version.changeSummary,
    })

    if (error) {
        if (error.code === '23505') throw new Error('Ижил нэртэй гэрээний сан аль хэдийн байна.')
        console.error('Unable to create contract template:', error.message)
        throw new Error('Гэрээний сан үүсгэж чадсангүй.')
    }

    refreshContracts(data)
    return { templateId: data as string }
}

export async function updateContractTemplateMetadata(templateId: string, formData: FormData) {
    assertUuid(templateId, 'Гэрээний сангийн дугаар')
    const { supabase } = await requireAdmin()
    const metadata = normalizeTemplateMetadata(formData)
    const { error } = await supabase
        .from('contract_templates')
        .update(metadata)
        .eq('id', templateId)

    if (error) {
        if (error.code === '23505') throw new Error('Ижил нэртэй гэрээний сан аль хэдийн байна.')
        throw new Error('Гэрээний сангийн мэдээллийг хадгалж чадсангүй.')
    }
    refreshContracts(templateId)
}

export async function setContractTemplateArchived(templateId: string, archived: boolean) {
    assertUuid(templateId, 'Гэрээний сангийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase
        .from('contract_templates')
        .update({ is_archived: archived })
        .eq('id', templateId)

    if (error) throw new Error('Гэрээний сангийн төлөвийг өөрчилж чадсангүй.')
    refreshContracts(templateId)
}

export async function updateContractDraft(versionId: string, formData: FormData) {
    assertUuid(versionId, 'Гэрээний хувилбарын дугаар')
    const { supabase } = await requireAdmin()
    const variableKeys = await getVariableKeys(supabase)
    const version = validateContractDraftInput(versionInputFromForm(formData), variableKeys)

    const { data, error } = await supabase
        .from('contract_template_versions')
        .update({
            title: version.title,
            content: version.content,
            change_summary: version.changeSummary,
        })
        .eq('id', versionId)
        .eq('status', 'draft')
        .select('template_id')
        .maybeSingle()

    if (error || !data) {
        console.error('Unable to update contract draft:', error?.message)
        throw new Error('Зөвхөн ноорог хувилбарыг засах боломжтой.')
    }
    refreshContracts(data.template_id)
}

export async function publishContractVersion(versionId: string) {
    assertUuid(versionId, 'Гэрээний хувилбарын дугаар')
    const { supabase } = await requireAdmin()
    const [{ data: version, error: versionError }, variableKeys] = await Promise.all([
        supabase
            .from('contract_template_versions')
            .select('template_id, title, content, change_summary, status')
            .eq('id', versionId)
            .maybeSingle(),
        getVariableKeys(supabase),
    ])

    if (versionError || !version || version.status !== 'draft') {
        throw new Error('Нийтлэх ноорог хувилбар олдсонгүй.')
    }

    validatePublishableContract({
        title: version.title,
        content: version.content,
        changeSummary: version.change_summary,
    }, variableKeys)

    const { error } = await supabase.rpc('publish_contract_template_version', { p_version_id: versionId })
    if (error) {
        console.error('Unable to publish contract version:', error.message)
        throw new Error(error.message.includes('archived')
            ? 'Архивласан гэрээний сангаас хувилбар нийтлэх боломжгүй.'
            : 'Гэрээний хувилбарыг нийтэлж чадсангүй.')
    }
    refreshContracts(version.template_id)
}

export async function createNextContractDraft(templateId: string) {
    assertUuid(templateId, 'Гэрээний сангийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase.rpc('create_contract_template_draft', { p_template_id: templateId })
    if (error) {
        console.error('Unable to create next contract draft:', error.message)
        throw new Error(error.message.includes('already has a draft')
            ? 'Энэ гэрээний санд засварлаж буй ноорог аль хэдийн байна.'
            : 'Шинэ ноорог хувилбар үүсгэж чадсангүй.')
    }
    refreshContracts(templateId)
}

export async function retireContractVersion(versionId: string, templateId: string) {
    assertUuid(versionId, 'Гэрээний хувилбарын дугаар')
    assertUuid(templateId, 'Гэрээний сангийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase.rpc('retire_contract_template_version', { p_version_id: versionId })
    if (error) {
        console.error('Unable to retire contract version:', error.message)
        throw new Error('Нийтлэгдсэн гэрээний хувилбарыг ашиглалтаас гаргаж чадсангүй.')
    }
    refreshContracts(templateId)
}

export async function deleteContractDraft(versionId: string, templateId: string) {
    assertUuid(versionId, 'Гэрээний хувилбарын дугаар')
    assertUuid(templateId, 'Гэрээний сангийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase
        .from('contract_template_versions')
        .delete()
        .eq('id', versionId)
        .eq('status', 'draft')

    if (error) throw new Error('Ноорог хувилбарыг устгаж чадсангүй.')
    refreshContracts(templateId)
}

export async function deleteDraftContractTemplate(templateId: string) {
    assertUuid(templateId, 'Гэрээний сангийн дугаар')
    const { supabase } = await requireAdmin()
    const { error } = await supabase.from('contract_templates').delete().eq('id', templateId)
    if (error) {
        throw new Error(error.message.includes('published history')
            ? 'Нийтлэгдсэн түүхтэй гэрээний санг устгах боломжгүй. Архивлана уу.'
            : 'Гэрээний санг устгаж чадсангүй.')
    }
    refreshContracts()
}
