import { getPayments, approvePayment, rejectPayment } from '@/features/admin/actions/admin-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Image as ImageIcon, Search, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export default async function AdminDashboard(props: { searchParams: Promise<{ status?: string, search?: string }> }) {
    const searchParams = await props.searchParams;
    const currentStatus = searchParams.status || 'pending'
    const currentSearch = searchParams.search || ''

    const payments = await getPayments({ status: currentStatus, search: currentSearch })

    return (
        <div className="min-h-screen bg-[#09090b] text-white p-8">
            <div className="container mx-auto max-w-5xl">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
                    <p className="text-zinc-400">Review and manage manual payment requests.</p>
                </header>

                <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                            <Link href={`/admin/payments?status=pending&search=${currentSearch}`}>
                                <button className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${currentStatus === 'pending' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                                    Pending
                                </button>
                            </Link>
                            <Link href={`/admin/payments?status=approved&search=${currentSearch}`}>
                                <button className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${currentStatus === 'approved' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                                    Approved
                                </button>
                            </Link>
                            <Link href={`/admin/payments?status=rejected&search=${currentSearch}`}>
                                <button className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${currentStatus === 'rejected' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                                    Declined
                                </button>
                            </Link>
                        </div>

                        <form action="/admin/payments" method="GET" className="relative flex-1 md:max-w-xs">
                            <input type="hidden" name="status" value={currentStatus} />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <input
                                type="text"
                                name="search"
                                defaultValue={currentSearch}
                                placeholder="Search by student or course..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </form>
                    </div>

                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        {currentStatus === 'pending' ? 'Pending Approvals' : currentStatus === 'approved' ? 'Approved Payments' : 'Declined Payments'}
                        <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">{payments?.length || 0}</span>
                    </h2>

                    <div className="grid gap-4">
                        {payments && payments.length > 0 ? (
                            payments.map((payment: any) => (
                                <Card key={payment.id} className="bg-zinc-900 border-zinc-800 text-white">
                                    <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">

                                        {/* User & Course Info */}
                                        <div className="space-y-1 flex-1">
                                            <p className="text-sm text-zinc-400">Student: <span className="text-white font-medium">{payment.profiles?.display_name || payment.user_id}</span></p>
                                            <h3 className="font-semibold text-lg">{payment.courses?.title}</h3>
                                            <p className="text-emerald-400 font-mono text-sm">{payment.courses?.price_display}</p>
                                            <p className="text-xs text-zinc-500 mt-2">Requested: {new Date(payment.created_at).toLocaleString()}</p>
                                        </div>

                                        {/* Receipt Viewer (Simulated) */}
                                        <div className="flex-1 bg-zinc-950 p-4 border border-zinc-800 rounded-md flex items-center justify-center gap-3">
                                            <ImageIcon className="h-8 w-8 text-zinc-600" />
                                            <div>
                                                <p className="text-sm font-medium">Payment Receipt</p>
                                                <a href={payment.proof_image_url} target="_blank" rel="noreferrer" className="text-indigo-400 text-xs hover:underline">
                                                    View Full Image (New Tab)
                                                </a>
                                            </div>
                                        </div>

                                        {/* Actions or Status Badge */}
                                        <div className="flex flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 min-w-[140px]">
                                            {payment.status === 'pending' ? (
                                                <>
                                                    <form action={async () => {
                                                        'use server';
                                                        await approvePayment(payment.id, payment.user_id, payment.course_id);
                                                        revalidatePath('/admin');
                                                    }}>
                                                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                                            Approve Payment
                                                        </Button>
                                                    </form>
                                                    <form action={async () => {
                                                        'use server';
                                                        await rejectPayment(payment.id);
                                                        revalidatePath('/admin');
                                                    }}>
                                                        <Button type="submit" variant="destructive" className="w-full bg-red-900/50 hover:bg-red-600 text-white">
                                                            Reject
                                                        </Button>
                                                    </form>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                                                    {payment.status === 'approved' ? (
                                                        <div className="flex items-center gap-2 text-emerald-400 font-medium">
                                                            <CheckCircle2 className="h-5 w-5" /> Approved
                                                        </div>
                                                    ) : payment.status === 'rejected' ? (
                                                        <div className="flex items-center gap-2 text-red-500 font-medium">
                                                            <XCircle className="h-5 w-5" /> Declined
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-yellow-500 font-medium">
                                                            <Clock className="h-5 w-5" /> {payment.status}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center p-12 bg-zinc-900/50 rounded-xl border border-zinc-800 text-zinc-400">
                                {currentSearch ? `No payments found matching "${currentSearch}".` : `No ${currentStatus} payment requests found.`}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}
