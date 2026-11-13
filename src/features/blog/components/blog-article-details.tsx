import Image from 'next/image'
import type { Locale } from '@/lib/i18n/locale'
import { blogMediaPath } from '@/features/blog/model'

export function BlogDate({ value, locale }: { value: string; locale: Locale }) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null

    return (
        <time dateTime={date.toISOString()}>
            {new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'mn-MN', {
                dateStyle: 'long',
                timeZone: 'Asia/Ulaanbaatar',
            }).format(date)}
        </time>
    )
}

type BlogCoverProps = {
    assetId: string
    alt: string
    preview?: boolean
    eager?: boolean
}

export function BlogCover({ assetId, alt, preview, eager }: BlogCoverProps) {
    return (
        <Image
            src={blogMediaPath(assetId, preview)}
            alt={alt}
            fill
            unoptimized
            loading={eager ? 'eager' : 'lazy'}
            className="object-cover"
        />
    )
}
