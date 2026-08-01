const imageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte)
}

function hasMatchingSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff])
  if (type === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (type === 'image/webp') {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  }
  return false
}

export async function validateImageFile(file: File, maximumBytes: number) {
  const extension = imageExtensions[file.type]
  if (!extension) throw new Error('Зөвхөн JPG, PNG, эсвэл WebP зураг ашиглана уу.')
  if (file.size > maximumBytes) throw new Error('Зургийн файлын хэмжээ хэтэрсэн байна.')

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!hasMatchingSignature(file.type, bytes)) {
    throw new Error('Файлын агуулга нь сонгосон зургийн төрөлтэй тохирохгүй байна.')
  }

  return extension
}
