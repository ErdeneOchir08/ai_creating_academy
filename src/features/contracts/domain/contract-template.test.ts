import { describe, expect, it } from 'vitest'
import {
    containsMalformedContractVariable,
    extractContractVariables,
    validateContractDraftInput,
    validatePublishableContract,
} from './contract-template'

const allowedVariables = new Set(['student_name', 'program_name'])

describe('contract template validation', () => {
    it('extracts unique variables in document order', () => {
        expect(extractContractVariables('{{student_name}} — {{program_name}} — {{student_name}}'))
            .toEqual(['student_name', 'program_name'])
    })

    it('detects malformed variable syntax', () => {
        expect(containsMalformedContractVariable('{{ student_name }}')).toBe(true)
        expect(containsMalformedContractVariable('{{student_name}}')).toBe(false)
    })

    it('rejects variables that are not in the controlled registry', () => {
        expect(() => validateContractDraftInput({
            title: 'TeenCoder сургалтын гэрээ',
            content: 'Суралцагч: {{unknown_name}}',
            changeSummary: '',
        }, allowedVariables)).toThrow('unknown_name')
    })

    it('requires meaningful content before publication', () => {
        expect(() => validatePublishableContract({
            title: 'TeenCoder сургалтын гэрээ',
            content: 'Суралцагч: {{student_name}}',
            changeSummary: '',
        }, allowedVariables)).toThrow('100 тэмдэгт')
    })
})
