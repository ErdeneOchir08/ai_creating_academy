import sharp from 'sharp'
import { validateImageFile } from './image-validation'

const maximumUploadBytes = 5 * 1024 * 1024
const maximumOutputBytes = 512 * 1024
const maximumInputPixels = 40_000_000

// Course covers are public marketing assets. Receipt uploads deliberately use
// their existing validation/storage path and never pass through this processor.
export async function prepareCourseCover(file: File) {
    await validateImageFile(file, maximumUploadBytes)
    const input = Buffer.from(await file.arrayBuffer())

    try {
        const metadata = await sharp(input, { limitInputPixels: maximumInputPixels }).metadata()
        if ((metadata.pages ?? 1) > 1) {
            throw new Error('Animated course covers are not supported')
        }

        const encode = (dimension: number, quality: number) => sharp(input, {
            limitInputPixels: maximumInputPixels,
        })
            .rotate()
            .resize({ width: dimension, height: dimension, fit: 'inside', withoutEnlargement: true })
            .webp({ quality, effort: 4 })
            .toBuffer()

        let data = await encode(1280, 80)
        if (data.length > maximumOutputBytes) data = await encode(960, 65)
        if (data.length > maximumOutputBytes) throw new Error('Optimized image is too large')

        return {
            data,
            extension: 'webp' as const,
            contentType: 'image/webp' as const,
            // Each replacement gets a fresh UUID, so old cached URLs never
            // silently change to a different cover.
            cacheControl: '31536000',
        }
    } catch {
        throw new Error('Зургийг боловсруулах боломжгүй байна. 40 мегапикселээс бага, хөдөлгөөнгүй JPG, PNG эсвэл WebP зураг сонгоно уу.')
    }
}
