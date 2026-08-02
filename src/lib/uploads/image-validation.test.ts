import { describe, expect, it } from 'vitest'

import { validateImageFile } from './image-validation'

function imageFile(bytes: number[], type: string) {
  return new File([new Uint8Array(bytes)], 'upload', { type })
}

describe('validateImageFile', () => {
  it.each([
    ['image/jpeg', [0xff, 0xd8, 0xff], 'jpg'],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'png'],
    ['image/webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'webp'],
  ])('accepts a valid %s signature', async (type, bytes, extension) => {
    await expect(validateImageFile(imageFile(bytes, type), 1024)).resolves.toBe(extension)
  })

  it('rejects unsupported image types with a readable Mongolian message', async () => {
    await expect(validateImageFile(imageFile([0x47, 0x49, 0x46], 'image/gif'), 1024))
      .rejects.toThrow('Зөвхөн JPG, PNG, эсвэл WebP зураг ашиглана уу.')
  })

  it('rejects files over the configured size limit', async () => {
    const file = imageFile([0xff, 0xd8, 0xff, 0], 'image/jpeg')
    await expect(validateImageFile(file, 3))
      .rejects.toThrow('Зургийн файлын хэмжээ хэтэрсэн байна.')
  })

  it('rejects a MIME type that does not match the file signature', async () => {
    const disguisedFile = imageFile([0xff, 0xd8, 0xff], 'image/png')
    await expect(validateImageFile(disguisedFile, 1024))
      .rejects.toThrow('Файлын агуулга нь сонгосон зургийн төрөлтэй тохирохгүй байна.')
  })
})
