import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // MUST BE SERVICE ROLE TO RUN RAW DDL

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createQATables() {
    const query = `
        -- Create questions table
        CREATE TABLE IF NOT EXISTS public.questions (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
            lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
            user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
            content text NOT NULL,
            is_answered boolean DEFAULT false,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        -- Create answers table
        CREATE TABLE IF NOT EXISTS public.answers (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
            user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
            content text NOT NULL,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        -- Enable RLS
        ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

        -- Policies for questions
        -- Anyone can read questions
        CREATE POLICY "Questions are viewable by everyone" ON public.questions FOR SELECT USING (true);
        -- Authenticated users can insert their own questions
        CREATE POLICY "Users can insert their own questions" ON public.questions FOR INSERT WITH CHECK (auth.uid() = user_id);
        -- Only admins can update questions (e.g., mark as answered)
        CREATE POLICY "Admins can update questions" ON public.questions FOR UPDATE USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );

        -- Policies for answers
        -- Anyone can read answers
        CREATE POLICY "Answers are viewable by everyone" ON public.answers FOR SELECT USING (true);
        -- Only admins can insert answers
        CREATE POLICY "Admins can insert answers" ON public.answers FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );
        -- Admins can update their answers
        CREATE POLICY "Admins can update answers" ON public.answers FOR UPDATE USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );
    `

    // Supabase JS client doesn't support raw SQL execution directly well without RPC.
    // However, since we used postgres.js earlier via migration scripts if we wrote one, we can do it via a direct fetch to the REST API via RPC, BUT the easiest way if we don't have RPC is just ask the user to run it in standard SQL Editor. Wait, we can use the supabase cli, but it's not installed. 
    // Let's create an RPC or just instruct the user if it fails.

    console.log("To setup the QA tables, please run the following SQL in the Supabase SQL Editor:\n\n" + query)
}

createQATables().catch(console.error)
