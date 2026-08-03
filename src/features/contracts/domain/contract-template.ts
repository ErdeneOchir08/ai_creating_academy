import { z } from 'zod'

const contractVariablePattern = /\{\{([a-z][a-z0-9_]*)\}\}/g

const contractDraftSchema = z.object({
    title: z.string().trim().min(1, 'Гэрээний гарчиг оруулна уу.').max(240, 'Гэрээний гарчиг 240 тэмдэгтээс урт байж болохгүй.'),
    content: z.string().max(100_000, 'Гэрээний агуулга 100,000 тэмдэгтээс урт байж болохгүй.'),
    changeSummary: z.string().trim().max(1_000, 'Өөрчлөлтийн тайлбар 1,000 тэмдэгтээс урт байж болохгүй.'),
})

export type ContractDraftInput = z.infer<typeof contractDraftSchema>

export function extractContractVariables(content: string) {
    return [...new Set([...content.matchAll(contractVariablePattern)].map((match) => match[1]))]
}
export function containsMalformedContractVariable(content: string) {
    const withoutValidVariables = content.replace(contractVariablePattern, '')
    return withoutValidVariables.includes('{{') || withoutValidVariables.includes('}}')
}

export function validateContractDraftInput(
    input: ContractDraftInput,
    allowedVariableKeys: ReadonlySet<string>,
) {
    const parsed = contractDraftSchema.parse(input)

    if (containsMalformedContractVariable(parsed.content)) {
        throw new Error('Хувьсагчийг {{student_name}} хэлбэрээр, зайгүй зөв бичнэ үү.')
    }

    const unknownVariables = extractContractVariables(parsed.content)
        .filter((key) => !allowedVariableKeys.has(key))

    if (unknownVariables.length > 0) {
        throw new Error(`Танигдаагүй гэрээний хувьсагч: ${unknownVariables.join(', ')}`)
    }

    return parsed
}

export function validatePublishableContract(
    input: ContractDraftInput,
    allowedVariableKeys: ReadonlySet<string>,
) {
    const parsed = validateContractDraftInput(input, allowedVariableKeys)
    if (parsed.content.trim().length < 100) {
        throw new Error('Нийтлэхийн өмнө гэрээний агуулга хамгийн багадаа 100 тэмдэгттэй байх шаардлагатай.')
    }
    return parsed
}
