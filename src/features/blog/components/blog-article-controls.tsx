'use client'

import { Check, Copy, ExternalLink, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type CopyButtonProps = {
    value: string
    label: string
    copiedLabel: string
    errorLabel: string
}

export function BlogCopyButton({ value, label, copiedLabel, errorLabel }: CopyButtonProps) {
    const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')

    async function copy() {
        try {
            await navigator.clipboard.writeText(value)
            setResult('copied')
        } catch {
            setResult('failed')
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button type="button" size="sm" variant="outline" onClick={copy}>
                {result === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {result === 'copied' ? copiedLabel : label}
            </Button>
            <span role="status" className={result === 'failed' ? 'text-xs text-zinc-300' : 'sr-only'}>
                {result === 'copied' ? copiedLabel : result === 'failed' ? errorLabel : ''}
            </span>
        </div>
    )
}

type YouTubeProps = {
    videoId: string
    title: string
    playLabel: string
    watchLabel: string
}

export function BlogYouTube({ videoId, title, playLabel, watchLabel }: YouTubeProps) {
    const [playing, setPlaying] = useState(false)
    const player = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        if (playing) player.current?.focus()
    }, [playing])

    return (
        <figure className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="relative aspect-video w-full">
                {playing ? (
                    <iframe
                        ref={player}
                        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
                        title={title}
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 size-full"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setPlaying(true)}
                        aria-label={`${playLabel} · ${title}`}
                        className="group absolute inset-0 flex size-full items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.22),transparent_72%)] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-indigo-300"
                    >
                        <span className="flex size-14 items-center justify-center rounded-full border border-indigo-300/50 bg-indigo-400/20 text-indigo-100 transition-colors group-hover:bg-indigo-400/35 sm:size-16">
                            <Play className="ml-0.5 size-6 fill-current" aria-hidden="true" />
                        </span>
                    </button>
                )}
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400">
                <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
                <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 text-indigo-200 hover:text-white"
                >
                    {watchLabel}<ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
            </figcaption>
        </figure>
    )
}
