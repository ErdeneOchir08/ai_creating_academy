export type CourseCheckoutMode = 'direct' | 'class_only'

export function parseCourseCheckoutMode(value: FormDataEntryValue | null): CourseCheckoutMode {
    if (value === null) return 'direct'
    if (value === 'direct' || value === 'class_only') return value
    throw new Error('Борлуулах хэлбэрээ сонгоно уу.')
}
