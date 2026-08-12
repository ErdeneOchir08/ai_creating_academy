export function latestCourses<T>(courses: T[], limit = 4) {
    return courses.slice(0, limit)
}
