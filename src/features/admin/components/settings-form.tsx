'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateAppSetting } from '@/features/admin/actions/settings-actions.admin'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

type SettingsMap = {
    telegram_bot_token?: string
    telegram_chat_id?: string
}

export function SettingsForm({ initialSettings }: { initialSettings: SettingsMap }) {
    const [token, setToken] = useState(initialSettings?.telegram_bot_token || '')
    const [chatId, setChatId] = useState(initialSettings?.telegram_chat_id || '')

    const [isLoading, setIsLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setSuccessMsg('')
        setErrorMsg('')

        try {
            const tokenRes = await updateAppSetting('telegram_bot_token', token)
            if (!tokenRes.success) throw new Error(tokenRes.error)

            const chatRes = await updateAppSetting('telegram_chat_id', chatId)
            if (!chatRes.success) throw new Error(chatRes.error)

            setSuccessMsg('Тохиргоог амжилттай хадгаллаа!')
        } catch (err: any) {
            setErrorMsg(err.message || 'Тохиргоог хадгалахад алдаа гарлаа')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                    Telegram мэдэгдлүүд
                </CardTitle>
                <CardDescription className="text-zinc-400">
                    Оюутан төлбөрийн хүсэлт илгээх үед шууд мэдэгдэл авахын тулд Telegram ботоо тохируулна уу.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                    {successMsg && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <p className="text-emerald-400 font-medium text-sm">{successMsg}</p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <p className="text-red-400 font-medium text-sm">{errorMsg}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="telegram_bot_token" className="text-zinc-300">Ботын Токен</Label>
                        <Input
                            id="telegram_bot_token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ж.нь: 1234567890:ABCdefGHIjklmnoPQRstuvWXYZ"
                            className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                        />
                        <p className="text-xs text-zinc-500 font-medium mt-1">
                            Telegram дээр <a href="https://t.me/botfather" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">@BotFather</a>-тай шинэ бот үүсгэж үүнийг авна уу.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="telegram_chat_id" className="text-zinc-300">Групп / Чатын ID</Label>
                        <Input
                            id="telegram_chat_id"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            placeholder="ж.нь: -1001234567890"
                            className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-700"
                        />
                        <p className="text-xs text-zinc-500 font-medium mt-1">
                            Ботоор мэдээлэл илгээх Чатын эсвэл Группийн ID. (Зөвлөгөө: ID-гаа олохын тулд <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">@userinfobot</a> ашиглана уу). Ботоо групптээ нэмэхээ мартуузай!
                        </p>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Хадгалж байна...
                            </>
                        ) : (
                            'Telegram тохиргоог хадгалах'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
