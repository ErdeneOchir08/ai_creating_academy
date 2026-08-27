import Link from 'next/link'
import { BookOpen, CreditCard, GraduationCap, MessageSquareText, Users } from 'lucide-react'
import { getAdminOverview } from '@/features/admin/actions/admin-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminPage() {
    const overview = await getAdminOverview()
    const cards = [
        { label: 'Ангиуд', value: overview.classes, description: 'Бүх сургалтын анги', href: '/admin/classes', icon: GraduationCap },
        { label: 'Суралцагчид', value: overview.students, description: 'Бүртгэлтэй суралцагч', href: '/admin/users', icon: Users },
        { label: 'Багш нар', value: overview.teachers, description: 'Багшийн эрхтэй хэрэглэгч', href: '/admin/users', icon: Users },
        { label: 'Хичээлийн контент', value: overview.courses, description: 'Видео хичээлийн бэлэн багц', href: '/admin/courses', icon: BookOpen },
        { label: 'Хүлээгдэж буй төлбөр', value: overview.pendingPayments, description: 'Админы хяналт шаардлагатай', href: '/admin/payments?status=pending', icon: CreditCard },
        { label: 'Хариу хүлээж буй асуулт', value: overview.unansweredQuestions, description: 'Суралцагчийн шинэ асуултууд', href: '/admin/qa', icon: MessageSquareText },
    ]

    return (
        <div className="p-5 md:p-8">
            <header className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-white">Админ тойм</h1>
                <p className="text-zinc-400">Платформын одоогийн үйл ажиллагааг нэг дороос хянах боломжтой.</p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                {cards.map((card) => {
                    const Icon = card.icon
                    return (
                        <Link key={card.label} href={card.href} className="group">
                            <Card className="h-full border-zinc-800 bg-zinc-950 text-white transition-colors group-hover:border-indigo-500/50">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-zinc-300">{card.label}</CardTitle>
                                    <Icon className="h-4 w-4 text-indigo-400" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-3xl font-bold">{card.value}</p>
                                    <CardDescription className="mt-1 text-zinc-500">{card.description}</CardDescription>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>

            <Card className="mt-6 border-zinc-800 bg-zinc-950 text-white">
                <CardHeader>
                    <CardTitle>Идэвхтэй элсэлт</CardTitle>
                    <CardDescription className="text-zinc-400">Төлбөр батлагдсан, одоогоор хичээл үзэх эрхтэй суралцагчдын тоо.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold text-emerald-400">{overview.activeEnrollments}</p>
                </CardContent>
            </Card>
        </div>
    )
}
