import { getAdminQATnbox } from '@/features/admin/qa/qa-admin-actions'
import { QAInboxClient } from './qa-inbox-client'

export default async function AdminQAPage() {
    const questions = await getAdminQATnbox()
    return <QAInboxClient initialQuestions={questions ?? []} />
}
