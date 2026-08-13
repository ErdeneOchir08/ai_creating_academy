import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentSettingsForm } from '@/features/admin/components/payment-settings-form'
import { TelegramNotificationSettings } from '@/features/admin/components/telegram-notification-settings'
import { AcademyProfileForm } from '@/features/admin/components/academy-profile-form'
import { ContractIssuerProfileForm } from '@/features/admin/components/contract-issuer-profile-form'
import { getAcademyProfile, getContractIssuerProfile, getPaymentConfiguration, getTelegramNotificationStatus } from '@/features/admin/actions/settings-actions.admin'

export default async function AdminSettingsPage() {
    const [profile, contractIssuer, configuration, telegram] = await Promise.all([
        getAcademyProfile(),
        getContractIssuerProfile(),
        getPaymentConfiguration(),
        getTelegramNotificationStatus(),
    ])

    return (
        <div className="mx-auto max-w-3xl space-y-8 p-5 sm:p-8">
            <header>
                <h1 className="text-3xl font-bold text-white">Тохиргоо</h1>
                <p className="mt-2 text-zinc-400">Суралцагчдад харагдах төлбөрийн мэдээллийг эндээс удирдана.</p>
            </header>

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader>
                    <CardTitle>Академийн профайл</CardTitle>
                    <CardDescription className="text-zinc-400">Нэр, холбоо барих болон сошиал мэдээлэл нь public header, footer дээр харагдана.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AcademyProfileForm profile={profile} />
                </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader>
                    <CardTitle>Гэрээ байгуулагчийн мэдээлэл</CardTitle>
                    <CardDescription className="text-zinc-400">
                        Гэрээний хуулийн этгээд, төлөөлөгч болон төлбөр хүлээн авах банкны мэдээллийг удирдана.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ContractIssuerProfileForm profile={contractIssuer} />
                </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader>
                    <CardTitle>Төлбөрийн тохиргоо</CardTitle>
                    <CardDescription className="text-zinc-400">Өөрчлөлтийг хадгалмагц шинэ заавар бүх хичээлийн төлбөрийн цонхонд гарна.</CardDescription>
                </CardHeader>
                <CardContent>
                    <PaymentSettingsForm configuration={configuration} />
                </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950 text-white">
                <CardHeader>
                    <CardTitle>Telegram мэдэгдэл</CardTitle>
                    <CardDescription className="text-zinc-400">Шинэ төлбөрийн хүсэлт бүрийг админ группт шууд илгээнэ.</CardDescription>
                </CardHeader>
                <CardContent>
                    <TelegramNotificationSettings configured={telegram.configured} />
                </CardContent>
            </Card>
        </div>
    )
}
