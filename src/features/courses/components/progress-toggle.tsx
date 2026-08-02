'use client'

import { useState } from 'react'
import confetti from 'canvas-confetti'
import { CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleLessonComplete } from '@/features/courses/actions/progress-actions'

export function ProgressToggle({ lessonId, courseId, isCompleted }: { lessonId: string; courseId: string; isCompleted: boolean }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function handleToggle() {
    setIsLoading(true); setError(null)
    try {
      await toggleLessonComplete(lessonId, courseId, isCompleted)
      if (!isCompleted) confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b'] })
    } catch (caughtError) {
      console.error('Failed to update progress', caughtError)
      setError('Ахиц хадгалагдсангүй. Хуудсыг шинэчлээд дахин оролдоно уу.')
    } finally { setIsLoading(false) }
  }
  return <div className="mt-4 space-y-2">
    <Button onClick={handleToggle} disabled={isLoading} variant={isCompleted ? 'secondary' : 'outline'} size="sm" className={`w-full justify-start ${isCompleted ? 'border-transparent bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'border-zinc-700 text-zinc-300 hover:text-white'}`}>
      {isCompleted ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Дууссан</> : <><Circle className="mr-2 h-4 w-4" /> Дууссанд тэмдэглэх</>}
    </Button>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
}
