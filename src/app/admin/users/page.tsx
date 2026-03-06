import { getAllUsers } from '@/features/admin/actions/user-actions'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { EditUserDialog } from '@/features/admin/components/edit-user-dialog'
import { DeleteUserAlert } from '@/features/admin/components/delete-user-alert'

export default async function AdminUsersPage() {
    const users = await getAllUsers()

    return (
        <div className="p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Users</h1>
                <p className="text-zinc-400">Manage all registered students and administrators.</p>
            </header>

            <Card className="bg-zinc-950 border-zinc-800 text-white">
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                    <CardDescription className="text-zinc-500">
                        A list of all users on the platform.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-zinc-800">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
                                    <TableHead className="text-zinc-400">Name / Email</TableHead>
                                    <TableHead className="text-zinc-400">Role</TableHead>
                                    <TableHead className="text-zinc-400 text-center">Enrollments</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Joined On</TableHead>
                                    <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length === 0 ? (
                                    <TableRow className="border-0 hover:bg-transparent">
                                        <TableCell colSpan={5} className="h-24 text-center text-zinc-500">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user: any) => (
                                        <TableRow key={user.id} className="border-zinc-800 hover:bg-zinc-800/50">
                                            <TableCell className="font-medium">
                                                {user.display_name || user.id}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={
                                                        user.role === 'admin'
                                                            ? 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30'
                                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                    }
                                                >
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {user.enrollments?.[0]?.count || 0}
                                            </TableCell>
                                            <TableCell className="text-right text-zinc-400 text-sm">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <EditUserDialog user={user} />
                                                    <DeleteUserAlert user={user} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
