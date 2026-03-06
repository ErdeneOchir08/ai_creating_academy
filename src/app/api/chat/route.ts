import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenerativeAIStream, StreamingTextResponse } from 'ai'
import { NextRequest } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
export const maxDuration = 30

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { messages, lessonContext } = body

        const systemPrompt = `You are a friendly, expert AI coding tutor for kids aged 12-18 at "AI Creator Academy". 
Your job is to help the student understand the material in their current lesson.

Current Lesson Context:
Title: ${lessonContext?.title || 'General AI Concepts'}
Description: ${lessonContext?.description || 'No description available.'}

CRITICAL RULES:
1. You MUST always reply in the Mongolian language. 
2. Keep your answers encouraging, simple, and easy to understand for a teenager.
3. If they ask about code, explain it step-by-step.
4. If they ask something completely unrelated to AI or coding, politely guide them back to the topic.`

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
        })

        const preparedMessages = messages.map((m: any, idx: number) => {
            if (idx === 0 && m.role === 'user') {
                return { ...m, content: `${systemPrompt}\n\nUser Question: ${m.content}` }
            }
            return m
        })

        const buildGoogleGenAIPrompt = (msgs: any[]) => {
            return {
                contents: msgs.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }],
                }))
            }
        }

        const streamingResponse = await model.generateContentStream(buildGoogleGenAIPrompt(preparedMessages))
        const stream = GoogleGenerativeAIStream(streamingResponse)

        return new StreamingTextResponse(stream)
    } catch (error: any) {
        console.error('API Route Error:', error)
        return new Response(JSON.stringify({ error: error.message || 'Unknown API Route error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
}
