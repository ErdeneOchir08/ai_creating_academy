import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: `ALTER TABLE courses ADD COLUMN original_price_display text;`
    })

    if (error) {
        console.error("ERROR MESSAGE:", error.message)
        console.error("ERROR DETAILS:", error.details)
        console.error("ERROR HINT:", error.hint)
    } else {
        console.log("SUCCESS:", data)
    }
}

test()
