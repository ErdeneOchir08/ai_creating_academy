'use client'

import { useId, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/language-provider'
import { beginBlogPdfUpload, finishBlogPdfUpload, uploadBlogImage } from '@/features/blog/server/blog-media'
import { getBlogEditorCopy } from './blog-editor-copy'

const imageTypes = ['image/jpeg', 'image/png', 'image/webp']
const mebibyte = 1024 * 1024

type UploadedAsset = { id: string; name: string }
type UploadProgress = { label: string; percent?: number }

function putBlogPdf(url: string, file: File, onProgress: (percent: number) => void) {
    return new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('PUT', url)
        request.timeout = 5 * 60 * 1000
        request.setRequestHeader('Content-Type', 'application/pdf')
        request.setRequestHeader('Cache-Control', 'max-age=0')
        request.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total))
        })
        request.addEventListener('load', () => {
            if (request.status >= 200 && request.status < 300) resolve()
            else reject(new Error(`PDF upload returned ${request.status}.`))
        })
        const fail = () => reject(new Error('The PDF upload was interrupted.'))
        request.addEventListener('error', fail)
        request.addEventListener('timeout', fail)
        request.addEventListener('abort', fail)
        request.send(file)
    })
}

export function BlogEditorAssetUpload({
    postId, kind, label, disabled, onUploaded, onUploadStateChange,
}: {
    postId: string
    kind: 'image' | 'pdf'
    label: string
    disabled: boolean
    onUploaded: (asset: UploadedAsset) => void
    onUploadStateChange: (uploading: boolean) => void
}) {
    const copy = getBlogEditorCopy(useLocale())
    const descriptionId = useId()
    const input = useRef<HTMLInputElement>(null)
    const [progress, setProgress] = useState<UploadProgress | null>(null)
    const [error, setError] = useState('')

    async function upload(file: File) {
        setError('')
        const allowed = kind === 'image'
            ? imageTypes.includes(file.type) && file.size <= 4 * mebibyte
            : (file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name))) && file.size <= 20 * mebibyte
        if (!file.size || !allowed) {
            setError(kind === 'image' ? copy.imageError : copy.pdfError)
            return
        }

        setProgress({ label: copy.uploading })
        onUploadStateChange(true)
        try {
            if (kind === 'image') {
                const formData = new FormData()
                formData.set('file', file)
                const result = await uploadBlogImage(postId, formData)
                if (result.ok) onUploaded(result.asset)
                else setError(result.error)
                return
            }

            const start = await beginBlogPdfUpload(postId, { name: file.name, size: file.size, type: file.type })
            if (!start.ok) {
                setError(start.error)
                return
            }

            await putBlogPdf(start.uploadUrl, file, (percent) => setProgress({ label: copy.uploading, percent }))
            setProgress({ label: copy.verifying })
            const result = await finishBlogPdfUpload(postId, start.assetId)
            if (result.ok) onUploaded(result.asset)
            else setError(result.error)
        } catch {
            setError(copy.uploadError)
        } finally {
            setProgress(null)
            onUploadStateChange(false)
        }
    }

    return (
        <div className="space-y-2">
            <input
                type="file"
                ref={input}
                hidden
                accept={kind === 'image' ? imageTypes.join(',') : 'application/pdf,.pdf'}
                onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void upload(file)
                }}
            />
            <Button type="button" variant="outline" size="sm" disabled={disabled || Boolean(progress)}
                className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white"
                onClick={() => input.current?.click()} aria-describedby={descriptionId}>
                <Upload aria-hidden="true" />{label}
            </Button>
            <p id={descriptionId} className="text-xs text-zinc-400">{kind === 'image' ? copy.imageLimits : copy.pdfLimits}</p>
            {progress && (
                <div className="space-y-1" role="status">
                    <p className="text-xs text-indigo-200">{progress.label} {progress.percent === undefined ? '' : `${progress.percent}%`}</p>
                    <progress className="h-1.5 w-full accent-indigo-400" max={100} value={progress.percent} aria-label={progress.label} />
                </div>
            )}
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </div>
    )
}
