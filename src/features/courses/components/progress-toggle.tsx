'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toggleLessonComplete } from '@/features/courses/actions/progress-actions'
import { CheckCircle2, Circle } from 'lucide-react'

import confetti from 'canvas-confetti'

export function ProgressToggle({ lessonId, courseId, isCompleted }: { lessonId: string; courseId: string; isCompleted: boolean }) {
    const [isLoading, setIsLoading] = useState(false)

    async function handleToggle() {
        setIsLoading(true)
        try {
            await toggleLessonComplete(lessonId, courseId, isCompleted)

            // If they just marked it as complete (it was NOT completed before), pop confetti! 🎉
            if (!isCompleted) {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b']
                })
            }
        } catch (error) {
            console.error('Failed to update progress', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            onClick={handleToggle}
            disabled={isLoading}
            variant={isCompleted ? "secondary" : "outline"}
            size="sm"
            className={`w-full justify-start mt-4 ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-transparent' : 'border-zinc-700 text-zinc-300 hover:text-white'}`}
        >
            {isCompleted ? (
                <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Completed
                </>
            ) : (
                <>
                    <Circle className="mr-2 h-4 w-4" />
                    Mark as Complete
                </>
            )}
        </Button>
    )
}
