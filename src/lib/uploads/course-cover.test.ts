import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { prepareCourseCover } from './course-cover'

async function fixture(width: number, height: number) {
    const bytes = await sharp({
        create: { width, height, channels: 3, background: '#6366f1' },
    }).png().toBuffer()
    return new File([new Uint8Array(bytes)], 'cover.png', { type: 'image/png' })
}

describe('course cover upload processing', () => {
    it('bounds image dimensions, preserves aspect ratio and produces a small WebP', async () => {
        const result = await prepareCourseCover(await fixture(2400, 1350))
        const metadata = await sharp(result.data).metadata()
        expect(metadata.format).toBe('webp')
        expect(metadata.width).toBe(1280)
        expect(metadata.height).toBe(720)
        expect(result.data.length).toBeLessThan(512 * 1024)
        expect(result.extension).toBe('webp')
        expect(result.contentType).toBe('image/webp')
        expect(result.cacheControl).toBe('31536000')
    })

    it('keeps small images at their original dimensions', async () => {
        const result = await prepareCourseCover(await fixture(320, 180))
        const metadata = await sharp(result.data).metadata()
        expect([metadata.width, metadata.height]).toEqual([320, 180])
    })

    it('rejects invalid image data even if the PNG signature is present', async () => {
        const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'bad.png', { type: 'image/png' })
        await expect(prepareCourseCover(file)).rejects.toThrow('Зургийг боловсруулах боломжгүй байна.')
    })

    it('rejects unsupported file types and oversized uploads before decoding', async () => {
        await expect(prepareCourseCover(new File(['text'], 'cover.svg', { type: 'image/svg+xml' })))
            .rejects.toThrow('Зөвхөн JPG, PNG, эсвэл WebP зураг ашиглана уу.')
        await expect(prepareCourseCover(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })))
            .rejects.toThrow('Зургийн файлын хэмжээ хэтэрсэн байна.')
    })
})
