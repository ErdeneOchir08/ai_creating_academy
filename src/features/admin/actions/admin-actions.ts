'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendPaymentStatusEmail } from '@/lib/email/payment-status'

type PaymentProfile = { display_name: string | null }
type PaymentCourse = { title: string | null; price_amount_mnt: number | null }
type PaymentRow = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  receipt_path: string
  created_at: string
  user_id: string
  course_id: string
  amount_mnt: number | null
  profiles: PaymentProfile[] | null
  courses: PaymentCourse | PaymentCourse[] | null
}
type PaymentWithReceiptUrl = Omit<PaymentRow, 'courses' | 'profiles'> & {
  proof_image_url: string | null
  profiles: PaymentProfile | null
  courses: (PaymentCourse & { price_display: string }) | null
}
type PaymentNotificationRecipient = {
  email: string | null
  display_name: string | null
  course_title: string | null
  bonus_course_titles: string[] | null
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
  if (role?.role !== 'admin') throw new Error('Not authorized')
  return { supabase, user }
}

async function notifyStudentOfPaymentDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string | null,
): Promise<{ sent: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('get_payment_request_notification_recipient_with_bonus', { p_request_id: requestId })
  if (error) {
    console.error('Unable to load payment notification recipient:', error.message)
    return { sent: false, error: 'Суралцагчийн имэйл хаягийг ачаалж чадсангүй.' }
  }

  const recipient = (data?.[0] ?? null) as PaymentNotificationRecipient | null
  if (!recipient?.email || !recipient.course_title) {
    console.error('Payment status email skipped because recipient data is incomplete.')
    return { sent: false, error: 'Суралцагчийн имэйл мэдээлэл дутуу байна.' }
  }

  const result = await sendPaymentStatusEmail({
    to: recipient.email,
    studentName: recipient.display_name || 'Суралцагч',
    courseTitle: recipient.course_title,
    bonusCourseTitles: recipient.bonus_course_titles ?? [],
    decision,
    rejectionReason,
  })
  if (!result.sent) {
    console.error('Payment status was saved but email delivery failed:', result.error)
    return result
  }

  return { sent: true }
}

export async function getAdminOverview() {
  const { supabase } = await requireAdmin()
  const [
    students,
    teachers,
    courses,
    pendingCoursePayments,
    pendingCohortPayments,
    pendingOfferingPayments,
    activeEnrollments,
    activeOfferingEnrollments,
    unansweredQuestions,
  ] = await Promise.all([
    supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('cohort_payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('course_offering_payment_proofs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('course_offering_enrollments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_answered', false),
  ])

  const failure = [
    students,
    teachers,
    courses,
    pendingCoursePayments,
    pendingCohortPayments,
    pendingOfferingPayments,
    activeEnrollments,
    activeOfferingEnrollments,
    unansweredQuestions,
  ].find((result) => result.error)
  if (failure?.error) {
    console.error('Unable to load admin overview:', failure.error.message)
    throw new Error('Unable to load the admin overview.')
  }

  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    courses: courses.count ?? 0,
    pendingPayments: (pendingCoursePayments.count ?? 0)
      + (pendingCohortPayments.count ?? 0)
      + (pendingOfferingPayments.count ?? 0),
    activeEnrollments: (activeEnrollments.count ?? 0) + (activeOfferingEnrollments.count ?? 0),
    unansweredQuestions: unansweredQuestions.count ?? 0,
  }
}

export async function getPayments({ status, search }: { status?: string; search?: string } = {}) {
  const { supabase } = await requireAdmin()
  const validStatuses = new Set(['pending', 'approved', 'rejected', 'all'])
  if (status && !validStatuses.has(status)) status = 'pending'
  let query = supabase.from('payment_requests').select(`
    id, status, receipt_path, created_at, user_id, course_id, amount_mnt,
    profiles!payment_requests_user_id_fkey ( display_name ),
    courses!payment_requests_course_id_fkey ( title, price_amount_mnt )
  `).order('created_at', { ascending: false })
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const result: PaymentWithReceiptUrl[] = await Promise.all((data ?? []).map(async (payment: PaymentRow) => {
    const { data: signed, error: signedUrlError } = await supabase.storage
      .from('payment-receipts')
      .createSignedUrl(payment.receipt_path, 300)

    if (signedUrlError) console.error('Unable to create receipt URL:', signedUrlError.message)

    const course = Array.isArray(payment.courses) ? payment.courses[0] : payment.courses
    const profile = Array.isArray(payment.profiles) ? payment.profiles[0] : payment.profiles
    const amount = payment.amount_mnt ?? course?.price_amount_mnt ?? null
    return {
      ...payment,
      profiles: profile ?? null,
      proof_image_url: signed?.signedUrl ?? null,
      courses: course && {
        ...course,
        price_display: amount === null ? '—' : new Intl.NumberFormat('mn-MN', {
          style: 'currency',
          currency: 'MNT',
          maximumFractionDigits: 0,
        }).format(amount),
      },
    }
  }))
  const courseIds = [...new Set(result.map((payment) => payment.course_id))]
  const { data: bonusRules, error: bonusRulesError } = courseIds.length
    ? await supabase.from('course_bonus_courses').select('source_course_id, bonus_course_id').in('source_course_id', courseIds)
    : { data: [], error: null }
  if (bonusRulesError) throw new Error(bonusRulesError.message)

  const bonusCourseIds = [...new Set((bonusRules ?? []).map((rule) => rule.bonus_course_id))]
  const { data: bonusCourses, error: bonusCoursesError } = bonusCourseIds.length
    ? await supabase.from('courses').select('id, title').in('id', bonusCourseIds)
    : { data: [], error: null }
  if (bonusCoursesError) throw new Error(bonusCoursesError.message)

  const bonusTitleById = new Map((bonusCourses ?? []).map((course) => [course.id, course.title]))
  const bonusTitlesBySourceCourse = new Map<string, string[]>()
  for (const rule of bonusRules ?? []) {
    const title = bonusTitleById.get(rule.bonus_course_id)
    if (title) bonusTitlesBySourceCourse.set(rule.source_course_id, [...(bonusTitlesBySourceCourse.get(rule.source_course_id) ?? []), title])
  }

  const approvedUserIds = [...new Set(result.filter((payment) => payment.status === 'approved').map((payment) => payment.user_id))]
  const { data: grantedBonusEnrollments, error: grantedBonusEnrollmentsError } = approvedUserIds.length
    ? await supabase
      .from('enrollments')
      .select('user_id, granted_by_course_id, courses!enrollments_course_id_fkey ( title )')
      .eq('status', 'active')
      .eq('grant_source', 'bonus')
      .in('user_id', approvedUserIds)
    : { data: [], error: null }
  if (grantedBonusEnrollmentsError) throw new Error(grantedBonusEnrollmentsError.message)

  const grantedBonusTitlesByPayment = new Map<string, string[]>()
  for (const enrollment of grantedBonusEnrollments ?? []) {
    const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses
    if (!enrollment.granted_by_course_id || !course?.title) continue
    const key = `${enrollment.user_id}:${enrollment.granted_by_course_id}`
    grantedBonusTitlesByPayment.set(key, [...(grantedBonusTitlesByPayment.get(key) ?? []), course.title])
  }

  const paymentsWithBonuses = result.map((payment) => {
    const wasApproved = payment.status === 'approved'
    return {
      ...payment,
      bonus_course_titles: wasApproved
        ? grantedBonusTitlesByPayment.get(`${payment.user_id}:${payment.course_id}`) ?? []
        : bonusTitlesBySourceCourse.get(payment.course_id) ?? [],
      bonus_course_status: wasApproved ? 'granted' : 'will_grant',
    }
  })

  if (!search) return paymentsWithBonuses
  const value = search.toLowerCase()
  return paymentsWithBonuses.filter((payment) => payment.profiles?.display_name?.toLowerCase().includes(value) || payment.courses?.title?.toLowerCase().includes(value))
}

export async function approvePayment(requestId: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('approve_payment_request', { p_request_id: requestId })
  if (error) {
    console.error('Unable to approve payment:', error.message)
    return { error: 'Төлбөрийг зөвшөөрч чадсангүй. Хуудсыг шинэчлээд дахин оролдоно уу.' }
  }
  const notification = await notifyStudentOfPaymentDecision(supabase, requestId, 'approved')
  revalidatePath('/admin/payments')
  revalidatePath('/dashboard/courses')
  return { success: true, notificationError: notification.error }
}

export async function rejectPayment(requestId: string, rejectionReason?: string) {
  const { supabase } = await requireAdmin()
  const reason = rejectionReason?.trim() || null
  if (reason && reason.length > 500) return { error: 'Татгалзсан шалтгаан 500 тэмдэгтээс урт байж болохгүй.' }
  const { error } = await supabase.rpc('reject_payment_request', { p_request_id: requestId, p_rejection_reason: reason })
  if (error) {
    console.error('Unable to reject payment:', error.message)
    return { error: 'Төлбөрийг татгалзаж чадсангүй. Хуудсыг шинэчлээд дахин оролдоно уу.' }
  }
  const notification = await notifyStudentOfPaymentDecision(supabase, requestId, 'rejected', reason)
  revalidatePath('/admin/payments')
  revalidatePath('/dashboard/courses')
  return { success: true, notificationError: notification.error }
}

export async function resendPaymentDecisionEmail(requestId: string) {
  const { supabase } = await requireAdmin()
  const { data: payment, error } = await supabase
    .from('payment_requests')
    .select('status, rejection_reason')
    .eq('id', requestId)
    .maybeSingle()

  if (error || !payment || (payment.status !== 'approved' && payment.status !== 'rejected')) {
    return { error: 'Энэ төлбөрийн имэйлийг дахин илгээх боломжгүй байна.' }
  }

  const notification = await notifyStudentOfPaymentDecision(supabase, requestId, payment.status, payment.rejection_reason)
  if (!notification.sent) return { error: notification.error ?? 'Имэйл илгээж чадсангүй.' }

  return { success: 'Суралцагчид имэйл дахин илгээгдлээ.' }
}
