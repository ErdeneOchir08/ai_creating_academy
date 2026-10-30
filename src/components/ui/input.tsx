"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/components/language-provider"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const t = useTranslations()
  const [visible, setVisible] = React.useState(false)
  const isPassword = type === "password"
  const generatedId = React.useId()
  const inputId = props.id ?? generatedId
  const input = (
    <input
      type={isPassword && visible ? "text" : type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
        isPassword && "pr-12"
      )}
      {...props}
      id={isPassword ? inputId : props.id}
    />
  )

  if (!isPassword) return input

  return (
    <div className="relative w-full">
      {input}
      <button
        type="button"
        aria-label={visible ? t("Нууц үг нуух") : t("Нууц үг харуулах")}
        aria-controls={inputId}
        aria-pressed={visible}
        title={visible ? t("Нууц үг нуух") : t("Нууц үг харуулах")}
        disabled={props.disabled}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

export { Input }
