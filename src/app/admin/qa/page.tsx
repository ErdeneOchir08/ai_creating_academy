import { getAdminQATnbox } from '@/features/admin/qa/qa-admin-actions'
import { QAInboxClient } from '@/app/admin/qa/qa-inbox-client'

export const metadata = {
    title: 'Q&A Inbox - Admin Portal',
}

export default async function AdminQAPage() {
    // Note: getAdminQATnbox returns an array of questions, but there's a typo in the function name inherited from before.
    const questions = await getAdminQATnbox()

    return (
        <QAInboxClient initialQuestions={questions} />
    )
}
