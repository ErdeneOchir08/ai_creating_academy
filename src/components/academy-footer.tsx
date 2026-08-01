import Link from 'next/link'
import { Clock3, Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react'
import { getAcademyProfile } from '@/features/admin/actions/settings-actions.admin'

export async function AcademyFooter() {
    const profile = await getAcademyProfile()
    const hasContactInformation = profile.publicEmail || profile.phone || profile.address || profile.businessHours

    return (
        <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-300">
            <div className="container mx-auto grid gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
                <section>
                    <h2 className="text-xl font-bold text-white">{profile.displayName}</h2>
                    {profile.shortDescription && <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">{profile.shortDescription}</p>}
                    <div className="mt-5 flex items-center gap-2">
                        {profile.facebookUrl && (
                            <a href={profile.facebookUrl} target="_blank" rel="noreferrer" aria-label={`${profile.displayName} Facebook`} className="rounded-md border border-zinc-800 p-2 text-zinc-300 transition-colors hover:border-indigo-500 hover:text-white">
                                <Facebook className="h-4 w-4" />
                            </a>
                        )}
                        {profile.instagramUrl && (
                            <a href={profile.instagramUrl} target="_blank" rel="noreferrer" aria-label={`${profile.displayName} Instagram`} className="rounded-md border border-zinc-800 p-2 text-zinc-300 transition-colors hover:border-indigo-500 hover:text-white">
                                <Instagram className="h-4 w-4" />
                            </a>
                        )}
                    </div>
                </section>

                {hasContactInformation && (
                    <section>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Холбоо барих</h2>
                        <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                            {profile.publicEmail && <li><a className="flex items-start gap-2 hover:text-white" href={`mailto:${profile.publicEmail}`}><Mail className="mt-0.5 h-4 w-4 shrink-0" />{profile.publicEmail}</a></li>}
                            {profile.phone && <li><a className="flex items-start gap-2 hover:text-white" href={`tel:${profile.phone.replace(/[^+\d]/g, '')}`}><Phone className="mt-0.5 h-4 w-4 shrink-0" />{profile.phone}</a></li>}
                            {profile.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{profile.address}</span></li>}
                        </ul>
                    </section>
                )}

                <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">Суралцах</h2>
                    <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                        <li><Link href="/#courses" className="hover:text-white">Хичээлүүд</Link></li>
                        {profile.websiteUrl && <li><a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-white">Албан ёсны вебсайт</a></li>}
                        {profile.businessHours && <li className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><span>{profile.businessHours}</span></li>}
                    </ul>
                </section>
            </div>
            <div className="border-t border-zinc-900">
                <div className="container mx-auto px-4 py-5 text-xs text-zinc-500">© {new Date().getFullYear()} {profile.displayName}. Бүх эрх хуулиар хамгаалагдсан.</div>
            </div>
        </footer>
    )
}
