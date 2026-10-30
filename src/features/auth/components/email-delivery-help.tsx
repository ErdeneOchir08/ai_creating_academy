'use client'

import { useTranslations } from '@/components/language-provider'
export function EmailDeliveryHelp() {
    const t = useTranslations()

    return (
        <p className="text-sm leading-relaxed text-zinc-400">{t("Mind Academy-ийн и-мэйлийг Inbox болон Spam / Junk хавтсаас шалгана уу. Spam-д байвал “Not spam” гэж тэмдэглээрэй. И-мэйл хаягаа зөв бичсэн эсэхээ шалгаж, хамгийн сүүлд ирсэн холбоосыг ашиглана уу.")}</p>
    )
}
