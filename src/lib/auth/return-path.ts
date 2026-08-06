const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u
const ENCODED_CONTROL_OR_BACKSLASH_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|5c|7f)/iu
const ENCODED_PROTOCOL_RELATIVE_PREFIX_PATTERN = /^\/%2f/iu

/**
 * Returns a same-origin application path, or null when the supplied value
 * could make the browser leave the application.
 */
export function getSafeReturnPath(value: unknown): string | null {
    if (typeof value !== 'string' || value.length === 0) return null
    if (!value.startsWith('/') || value.startsWith('//')) return null
    if (value.includes('\\') || CONTROL_CHARACTER_PATTERN.test(value)) return null

    // Reject encoded variants before another browser/framework decoding pass
    // can turn them into a protocol-relative URL, backslash, or control byte.
    if (ENCODED_CONTROL_OR_BACKSLASH_PATTERN.test(value)) return null
    if (ENCODED_PROTOCOL_RELATIVE_PREFIX_PATTERN.test(value)) return null

    try {
        const baseUrl = new URL('https://return-path.invalid')
        const parsedUrl = new URL(value, baseUrl)
        if (parsedUrl.origin !== baseUrl.origin) return null
    } catch {
        return null
    }

    return value
}

export function withReturnPath(path: string, returnPath: unknown): string {
    const safeReturnPath = getSafeReturnPath(returnPath)
    if (!safeReturnPath) return path

    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}next=${encodeURIComponent(safeReturnPath)}`
}
