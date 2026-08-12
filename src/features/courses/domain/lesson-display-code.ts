export const LESSON_DISPLAY_CODE_MAX_LENGTH = 32

export function normalizeLessonDisplayCode(value: unknown) {
    const displayCode = typeof value === 'string' ? value.trim() : ''
    if (!displayCode) return null

    if (displayCode.length > LESSON_DISPLAY_CODE_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(displayCode)) {
        throw new Error(`Хичээлийн дугаар ${LESSON_DISPLAY_CODE_MAX_LENGTH}-оос олон тэмдэгтгүй байна.`)
    }

    return displayCode
}

export function lessonDisplayLabel(displayCode: string | null | undefined, fallbackPosition: number, padded = false) {
    const normalizedCode = displayCode?.trim()
    if (normalizedCode) return normalizedCode
    return padded ? String(fallbackPosition).padStart(2, '0') : String(fallbackPosition)
}
