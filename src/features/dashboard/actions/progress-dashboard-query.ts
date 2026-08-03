export const PROGRESS_ENROLLMENT_SELECT = `
    course_id,
    course:courses!enrollments_course_id_fkey (
        id,
        title,
        thumbnail_path,
        lessons (id, title, position)
    )
`
