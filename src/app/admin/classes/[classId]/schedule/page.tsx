import { notFound } from 'next/navigation'

import { getAdminClassControl } from '@/features/admin/actions/class-control-actions.admin'
import { getTeacherOptions } from '@/features/admin/actions/guided-class-actions.admin'
import { ClassScheduleEditor } from '@/features/admin/components/class-schedule-editor'

export const maxDuration = 60

export default async function AdminClassSchedulePage({
    params,
}: {
    params: Promise<{ classId: string }>
}) {
    const { classId } = await params
    const [classControl, teachers] = await Promise.all([
        getAdminClassControl(classId),
        getTeacherOptions(),
    ])
    if (!classControl
        || classControl.checkoutVersion !== 2
        || !['open', 'closed'].includes(classControl.status)
        || !['instructor_led_online', 'offline_with_video'].includes(classControl.classType)) {
        notFound()
    }

    return <ClassScheduleEditor classControl={classControl} teachers={teachers} />
}
