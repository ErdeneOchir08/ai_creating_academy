'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { updateUserRole } from '@/features/admin/actions/user-actions'
import { Edit2 } from 'lucide-react'

export function EditUserDialog({ user }: { user: any }) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedRole, setSelectedRole] = useState<'student' | 'admin'>(user.role)

    async function handleSave() {
        setIsLoading(true)
        try {
            await updateUserRole(user.id, selectedRole)
            setOpen(false)
        } catch (error) {
            console.error(error)
            alert('Failed to update user role.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                    <Edit2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Edit User Role</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Change access permissions for {user.display_name || user.email || 'this user'}.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Role</label>
                        <Select value={selectedRole} onValueChange={(val: 'student' | 'admin') => setSelectedRole(val)}>
                            <SelectTrigger className="w-full bg-zinc-900 border-zinc-800">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            Administrators have full access to create courses and manage payments.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
