'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { signup } from '@/features/auth/actions/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button
            className="w-full h-11 bg-white text-black hover:bg-zinc-200 transition-all duration-300 font-semibold rounded-xl"
            type="submit"
            disabled={pending}
        >
            {pending ? 'Creating account...' : 'Create Account'}
        </Button>
    )
}

export function RegisterForm() {
    const [error, setError] = useState<string | null>(null)

    async function clientAction(formData: FormData) {
        const result = await signup(formData)
        if (result?.error) {
            setError(result.error)
        }
    }

    return (
        <Card className="w-full max-w-md mx-auto bg-zinc-950/40 border-zinc-800/50 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="space-y-2 pb-6">
                <CardTitle className="text-2xl font-bold text-white">Create an account</CardTitle>
                <CardDescription className="text-zinc-400">Join the academy to start your AI learning journey.</CardDescription>
            </CardHeader>
            <form action={clientAction}>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-zinc-300">Full Name</Label>
                        <Input
                            id="full_name"
                            name="full_name"
                            placeholder="John Doe"
                            required
                            className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl h-11 focus-visible:ring-indigo-500/50 transition-all duration-300"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-zinc-300">Email address</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="m@example.com"
                            required
                            className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl h-11 focus-visible:ring-indigo-500/50 transition-all duration-300"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-zinc-300">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                            minLength={6}
                            className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 rounded-xl h-11 focus-visible:ring-indigo-500/50 transition-all duration-300"
                        />
                    </div>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-500 font-medium">
                            {error}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-5 pt-2">
                    <SubmitButton />
                    <div className="text-sm text-center text-zinc-400 w-full">
                        Already have an account?{' '}
                        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium transition-colors">
                            Log in instead
                        </Link>
                    </div>
                </CardFooter>
            </form>
        </Card>
    )
}
