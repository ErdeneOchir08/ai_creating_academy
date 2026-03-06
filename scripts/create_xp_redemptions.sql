-- Create xp_redemptions table to track when a student cashes in XP for a discount
CREATE TABLE public.xp_redemptions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    xp_amount_spent INTEGER NOT NULL CHECK (xp_amount_spent > 0),
    discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.xp_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own redemptions"
ON public.xp_redemptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own redemptions"
ON public.xp_redemptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own redemptions"
ON public.xp_redemptions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
