'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { adminCreateStudentProject, adminDeleteStudentProject } from '@/features/admin/actions/project-actions.admin'
import { Trash2, ImageIcon, Plus, Loader2 } from 'lucide-react'

export function AdminProjectsClient({ initialProjects, courses }: { initialProjects: any[], courses: any[] }) {
    const [projects, setProjects] = useState(initialProjects)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)

    // Form State
    const [studentName, setStudentName] = useState('')
    const [projectTitle, setProjectTitle] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [courseId, setCourseId] = useState('none')

    const supabase = createClient()

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploadingImage(true)
            if (!e.target.files || e.target.files.length === 0) return

            const file = e.target.files[0]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
            const filePath = `projects/${fileName}`

            // Reusing course-images bucket as planned
            const { error: uploadError } = await supabase.storage
                .from('course-images')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('course-images')
                .getPublicUrl(filePath)

            setImageUrl(data.publicUrl)
        } catch (error) {
            console.error('Error uploading image:', error)
            alert('Failed to upload image.')
        } finally {
            setUploadingImage(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!studentName || !projectTitle || !imageUrl) return alert('Please fill all required fields and upload an image.')

        setIsSubmitting(true)
        const formData = new FormData()
        formData.append('student_name', studentName)
        formData.append('project_title', projectTitle)
        formData.append('image_url', imageUrl)
        if (courseId !== 'none') formData.append('course_id', courseId)

        try {
            const result = await adminCreateStudentProject(formData)
            if (!result.success) throw new Error(result.error)

            // Reset form on success (the page will refresh or we can mutate local state, 
            // but relying on the server component's revalidatePath is safer for initialProjects.
            // For instant feedback without full reload we do:)
            alert('Project added successfully! It will now appear on the landing page.')
            window.location.reload()
        } catch (error) {
            console.error(error)
            alert('Failed to add project.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this project? It will be removed from the landing page.')) return

        try {
            const result = await adminDeleteStudentProject(id)
            if (result.success) {
                setProjects(prev => prev.filter(p => p.id !== id))
            }
        } catch (error) {
            console.error(error)
            alert('Failed to delete project.')
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Add New Project Form */}
            <div className="lg:col-span-1">
                <Card className="bg-zinc-900 border-zinc-800 shadow-xl sticky top-8">
                    <CardContent className="p-6">
                        <h2 className="text-xl font-bold text-white mb-6">Add New Project</h2>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="studentName" className="text-zinc-300">Student Name</Label>
                                <Input
                                    id="studentName"
                                    value={studentName}
                                    onChange={e => setStudentName(e.target.value)}
                                    className="bg-zinc-950 border-zinc-800"
                                    placeholder="e.g. Jane Doe"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="projectTitle" className="text-zinc-300">Project Title</Label>
                                <Input
                                    id="projectTitle"
                                    value={projectTitle}
                                    onChange={e => setProjectTitle(e.target.value)}
                                    className="bg-zinc-950 border-zinc-800"
                                    placeholder="e.g. AI Content Generator"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="courseId" className="text-zinc-300">Related Course (Optional)</Label>
                                <Select value={courseId} onValueChange={setCourseId}>
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                                        <SelectValue placeholder="Select Course" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                        <SelectItem value="none">None</SelectItem>
                                        {courses.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-300">Project Screenshot</Label>
                                <div className={`border-2 border-dashed rounded-lg p-4 text-center ${imageUrl ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/50'} transition-all`}>
                                    {imageUrl ? (
                                        <div className="space-y-3">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-md border border-zinc-800 shadow-sm" />
                                            <Button type="button" variant="outline" size="sm" className="w-full bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800" onClick={() => setImageUrl('')}>
                                                Remove Image
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 relative py-4">
                                            <div className="mx-auto w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                                                {uploadingImage ? <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" /> : <ImageIcon className="h-5 w-5 text-zinc-400" />}
                                            </div>
                                            <div className="text-sm text-zinc-400">
                                                <span className="font-medium text-indigo-400">Click to upload</span> or drag and drop
                                            </div>
                                            <input
                                                type="file"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={uploadingImage}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20"
                                disabled={isSubmitting || uploadingImage || !imageUrl}
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                Publish Showcase Project
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* List Existing Projects */}
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Active Projects</h2>
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/5">
                        {projects.length} Total
                    </Badge>
                </div>

                {projects.length === 0 ? (
                    <div className="p-12 text-center rounded-xl border border-zinc-800 border-dashed bg-zinc-900/50">
                        <ImageIcon className="h-12 w-12 text-zinc-600 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-white mb-2">No projects uploaded</h3>
                        <p className="text-zinc-500 max-w-sm mx-auto">Add your first student project showcase on the left to see it instantly appear on the landing page!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {projects.map((project) => (
                            <div key={project.id} className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-all shadow-sm">
                                <div className="aspect-video relative overflow-hidden bg-zinc-950">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={project.image_url}
                                        alt={project.project_title}
                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                                        <h3 className="text-white font-bold leading-tight line-clamp-1">{project.project_title}</h3>
                                        <p className="text-indigo-300 text-sm flex items-center gap-1.5 mt-1">
                                            Built by {project.student_name}
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8 bg-red-500 hover:bg-red-600 shadow-xl"
                                        onClick={() => handleDelete(project.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-white" />
                                    </Button>
                                </div>
                                {project.courses?.title && (
                                    <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950/50">
                                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">From Course</span>
                                        <p className="text-xs text-zinc-300 truncate">{project.courses.title}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
