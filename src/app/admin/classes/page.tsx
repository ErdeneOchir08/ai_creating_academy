import { getAdminClassSummaries } from '@/features/admin/actions/class-control-actions.admin'
import { ClassLibrary } from '@/features/admin/components/class-library'

type SearchParams = { view?: string }

export default async function AdminClassesPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>
}) {
    const [{ view }, classes] = await Promise.all([
        searchParams,
        getAdminClassSummaries(),
    ])

    return <ClassLibrary classes={classes} selectedView={view} />
}
