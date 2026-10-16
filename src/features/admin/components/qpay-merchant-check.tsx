'use client'

import { useState, useTransition } from 'react'
import { checkQpayMerchantConnections } from '../actions/qpay-merchant-check.admin'

export function QpayMerchantCheck() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState('')
    return <details className="mb-6 rounded-xl border border-zinc-800 p-4 text-sm">
        <summary className="cursor-pointer text-zinc-400">QPay мерчант холболт шалгах</summary>
        <p className="my-3 text-zinc-400">Нэхэмжлэл үүсгэхгүй, төлбөр авахгүй. Зөвхөн серверийн холболтыг шалгана.</p>
        <button type="button" disabled={pending} className="rounded-lg bg-zinc-800 px-4 py-2 disabled:opacity-50" onClick={() => startTransition(async () => {
            try {
                const result = await checkQpayMerchantConnections()
                setMessage(`Шинэ нэхэмжлэлийн мерчант: ${result.active}. ${result.connections.map(({ merchant, connected }) => `${merchant}: ${connected ? 'Холбогдсон' : 'Холболт амжилтгүй'}`).join(' · ')}`)
            } catch {
                setMessage('Шалгаж чадсангүй. Админаар нэвтэрсэн эсэхээ шалгана уу.')
            }
        })}>{pending ? 'Шалгаж байна…' : 'Холболт шалгах'}</button>
        <p role="status" className="mt-3 text-zinc-300">{message}</p>
    </details>
}
