'use client'

import React, { useState, useRef } from 'react'
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageUploadProps {
    name: string
    defaultValue?: string
    onChange?: (file: File | null) => void
}

export function ImageUpload({ name, defaultValue, onChange }: ImageUploadProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(defaultValue || null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.')
            return
        }

        // Create a local blob URL for preview
        const objectUrl = URL.createObjectURL(file)
        setPreviewUrl(objectUrl)

        if (onChange) {
            onChange(file)
        }
    }

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0])
        }
    }

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0])

            // Sync dropped file back to the hidden input for native FormData extraction
            if (fileInputRef.current) {
                const dataTransfer = new DataTransfer()
                dataTransfer.items.add(e.dataTransfer.files[0])
                fileInputRef.current.files = dataTransfer.files
            }
        }
    }

    const removeImage = () => {
        setPreviewUrl(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        if (onChange) {
            onChange(null)
        }
    }

    return (
        <div className="w-full">
            {/* Hidden Input field for FormData to grab automatically */}
            <input
                type="file"
                name={name}
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={onFileChange}
            />

            {!previewUrl ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`
                        w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200
                        ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/50'}
                    `}
                >
                    <UploadCloud className={`w-10 h-10 mb-3 ${isDragging ? 'text-indigo-400' : 'text-zinc-500'}`} />
                    <p className="text-sm font-medium text-white">Click or drag image to upload</p>
                    <p className="text-xs text-zinc-500 mt-1">PNG, JPG, JPEG up to 5MB</p>
                </div>
            ) : (
                <div className="relative w-full h-48 rounded-2xl border border-zinc-700 overflow-hidden bg-zinc-900 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={previewUrl}
                        alt="Upload preview"
                        className="w-full h-full object-cover"
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={removeImage}
                            className="bg-red-500 hover:bg-red-600 rounded-full"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Remove Image
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
