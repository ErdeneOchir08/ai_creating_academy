'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteUser } from '@/features/admin/actions/user-actions'
import { Trash2 } from 'lucide-react'

export function DeleteUserAlert({ user }: { user: any }) {
    const [isLoading, setIsLoading] = useState(false)

    async function handleConfirm() {
        setIsLoading(true)
        try {
            await deleteUser(user.id)
        } catch (error) {
            console.error(error)
            alert('Хэрэглэгчийг устгахад алдаа гарлаа.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400 hover:bg-red-950/50">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
                <AlertDialogHeader>
                    <AlertDialogTitle>Та үнэхээр итгэлтэй байна уу?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                        Энэ үйлдлийг буцаах боломжгүй. Энэ нь дараах профайлыг бүрмөсөн устгах болно: <span className="text-white font-semibold">{user.display_name || user.email || 'энэ хэрэглэгч'}</span>
                        {(user.enrollments?.[0]?.count || 0) > 0 && " болон тэдний бүх идэвхтэй элсэлтүүдийг хуулах болно."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800 hover:text-white">
                        Цуцлах
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isLoading ? 'Устгаж байна...' : 'Хэрэглэгч устгах'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
