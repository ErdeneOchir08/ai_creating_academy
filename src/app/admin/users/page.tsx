import { getAllUsers, type AdminUser } from '@/features/admin/actions/user-actions'
import { EditUserDialog } from '@/features/admin/components/edit-user-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const roleLabel = { student: 'Суралцагч', teacher: 'Багш', admin: 'Админ' } as const

export default async function AdminUsersPage() {
  const users = await getAllUsers()

  return (
    <div className="p-5 md:p-8">
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white">Хэрэглэгчид</h1>
        <p className="text-zinc-400">Суралцагч, багш, админы эрхийг удирдана.</p>
      </header>
      <Card className="border-zinc-800 bg-zinc-950 text-white">
        <CardHeader>
          <CardTitle>Бүх хэрэглэгч</CardTitle>
          <CardDescription className="text-zinc-500">Платформд бүртгэлтэй хэрэглэгчдийн жагсаалт.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-zinc-800">
            <Table>
              <TableHeader><TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                <TableHead className="text-zinc-400">Нэр</TableHead>
                <TableHead className="text-zinc-400">Эрх</TableHead>
                <TableHead className="text-center text-zinc-400">Элсэлт</TableHead>
                <TableHead className="text-right text-zinc-400">Бүртгүүлсэн</TableHead>
                <TableHead className="text-right text-zinc-400">Үйлдэл</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {users.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center text-zinc-500">Хэрэглэгч олдсонгүй.</TableCell></TableRow> : users.map((user: AdminUser) => (
                  <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="font-medium">{user.display_name || user.id}</TableCell>
                    <TableCell><Badge variant="secondary" className={user.role === 'admin' ? 'bg-indigo-600/20 text-indigo-300' : user.role === 'teacher' ? 'bg-amber-500/10 text-amber-300' : 'bg-zinc-800 text-zinc-300'}>{roleLabel[user.role as keyof typeof roleLabel] || user.role}</Badge></TableCell>
                    <TableCell className="text-center text-zinc-300">{user.enrollment_count}</TableCell>
                    <TableCell className="text-right text-sm text-zinc-400">{new Date(user.created_at).toLocaleDateString('mn-MN')}</TableCell>
                    <TableCell className="text-right"><EditUserDialog user={user} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
