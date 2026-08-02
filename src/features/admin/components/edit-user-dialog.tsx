'use client'

import { useState } from 'react'
import { Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateUserRole } from '@/features/admin/actions/user-actions'

type Role = 'student' | 'teacher' | 'admin'
type User = { id: string; display_name?: string | null; role: Role }

export function EditUserDialog({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role>(user.role)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await updateUserRole(user.id, selectedRole)
      if (!result?.success) throw new Error('Эрхийг шинэчилж чадсангүй.')
      setOpen(false)
    } catch (caughtError) {
      console.error(caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Эрхийг шинэчилж чадсангүй.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Хэрэглэгчийн эрх засах">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Хэрэглэгчийн эрх засах</DialogTitle>
          <DialogDescription className="text-zinc-400">{user.display_name || 'Хэрэглэгч'}-ийн платформын эрхийг сонгоно уу.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <label className="text-sm font-medium text-zinc-300" htmlFor="role">Эрх</label>
          <Select value={selectedRole} onValueChange={(value: Role) => setSelectedRole(value)}>
            <SelectTrigger id="role" className="w-full border-zinc-800 bg-zinc-900"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
              <SelectItem value="student">Суралцагч</SelectItem>
              <SelectItem value="teacher">Багш</SelectItem>
              <SelectItem value="admin">Админ</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-zinc-500">Админ нь хичээл, хэрэглэгч, төлбөрийг удирдана.</p>
          {error && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">Болих</Button>
          <Button onClick={handleSave} disabled={isLoading} className="bg-indigo-600 text-white hover:bg-indigo-700">{isLoading ? 'Хадгалж байна…' : 'Эрх хадгалах'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
