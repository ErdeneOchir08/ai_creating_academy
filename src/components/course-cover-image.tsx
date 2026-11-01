import Image from 'next/image'
import { canOptimizeCourseCover, getCourseCoverSource } from '@/lib/images/course-cover'

type CourseCoverImageProps = {
    src: string
    alt: string
    sizes: string
    className?: string
}

export function CourseCoverImage({ src, alt, sizes, className = '' }: CourseCoverImageProps) {
    const imageClassName = `h-full w-full object-cover ${className}`
    const coverSource = getCourseCoverSource(src)

    if (coverSource === src && !canOptimizeCourseCover(src)) {
        // Preserve older external covers without giving them access to the
        // public optimizer or changing how authenticated images are retrieved.
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={alt} loading="lazy" decoding="async" className={imageClassName} />
    }

    return <Image src={coverSource} alt={alt} fill sizes={sizes} quality={75} loading="lazy" className={imageClassName} />
}
