/** Recovery tokens stay in the URL fragment, never in server request logs. */
export function recoveryTokenFromHash(hash: string): string | null {
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const token = params.get('token_hash')
    return token && /^(?:pkce_)?[a-f0-9]{32,128}$/i.test(token) ? token : null
}

export async function verifyRecoveryToken(
    token: string,
    verify: (input: { token_hash: string; type: 'recovery' }) => Promise<{ error: unknown; data: { session: unknown } }>,
): Promise<boolean> {
    if (!recoveryTokenFromHash(`#token_hash=${encodeURIComponent(token)}`)) return false
    const result = await verify({ token_hash: token, type: 'recovery' })
    return !result.error && !!result.data.session
}
