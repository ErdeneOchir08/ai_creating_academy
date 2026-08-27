import { notFound } from 'next/navigation'
import { getAdminClassControl } from '@/features/admin/actions/class-control-actions.admin'
import { ClassControlCenter } from '@/features/admin/components/class-control-center'

export default async function AdminClassControlPage({
    params,
}: {
    params: Promise<{ classId: string }>
}) {
    const { classId } = await params
    const classControl = await getAdminClassControl(classId)
    if (!classControl) notFound()

    return <ClassControlCenter classControl={classControl} />
}
