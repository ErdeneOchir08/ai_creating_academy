# AI Creator Academy Deployment Guide

Welcome! Deploying your application makes it accessible to the world. Since this is a modern Next.js 15 app connected to Supabase, we will deploy it using **Vercel**. Vercel is the company that created Next.js, so their hosting platform is heavily optimized and mostly automatic.

---

## Step 1: Upload Your Code strictly to GitHub

Right now, all your code lives locally on your computer. We need to upload it to GitHub so Vercel can read it.

1. Open your code editor (like VS Code) and open a **New Terminal** window.
2. Run these commands one by one:
   ```bash
   git add .
   git commit -m "Ready for production"
   ```
3. Go to [GitHub.com](https://github.com/) and create a **New Repository**.
   - Name it `ai-creator-academy`.
   - Set the visibility to **Private**.
4. GitHub will show you a setup page. Look for the section titled: *"...or push an existing repository from the command line"*.
5. **Copy the two lines of code** in that section, paste them into your Terminal, and hit Enter.
   - Your code is now securely uploaded!

---

## Step 2: Prepare Vercel

Now we tell Vercel to grab that code from GitHub and build your live website.

1. Go to [Vercel.com](https://vercel.com/) and sign up or log in using your **GitHub account**.
2. On your dashboard, click **Add New...** -> **Project**.
3. Under "Import Git Repository," find your `ai-creator-academy` repository and click **Import**.
4. A configuration screen will appear. Leave the Framework Preset as "Next.js".
5. **Add Environment Variables (Crucial Step):**
   - Open the `.env.local` file on your computer.
   - Copy the values and paste them into Vercel exact as they appear. You need three keys:
     - Name: `NEXT_PUBLIC_SUPABASE_URL` | Value: *(Your Supabase URL)*
     - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Value: *(Your Supabase API Key)*
     - Name: `GOOGLE_GENERATIVE_AI_API_KEY` | Value: *(Your Gemini API Key)*
6. Click **Deploy**.
   - Vercel will now build your app. This takes about 60-90 seconds.
   - When it’s done, you will see a big "Congratulations" screen and a live URL (e.g., `ai-creator-academy.vercel.app`).

---

## Step 3: Link Supabase to Your Live URL

Your database (Supabase) currently only allows logins from `localhost:3000`. We need to tell it to trust your new Vercel website.

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. On the left sidebar, click **Authentication** -> **URL Configuration**.
3. Under **Site URL**, paste your new Vercel URL (e.g., `https://ai-creator-academy.vercel.app`).
4. Scroll down to **Redirect URLs**. Add a new one that looks exactly like your URL but with `/**` at the end:
   - `https://ai-creator-academy.vercel.app/**`
5. Click **Save**.

---

## Step 4: Final Verification!

1. Go to your live Vercel URL in your web browser. The app should load beautifully.
2. Click **Login / Register** and create a brand new account for yourself on the live site.
3. Because you just created a new account, your role is currently "Student". Let's make you an Admin.
4. Go back to your [Supabase Dashboard](https://supabase.com/dashboard) -> **Table Editor** -> `profiles` table.
5. Find the new account you just created.
6. Double-click the cell under the `role` column and change it from `"student"` to `"admin"`.
7. Go back to your live website and refresh the page.
8. You should now see the **Admin Portal** button! You can start creating your real courses, uploading video links, and managing your students.

Congratulations on launching AI Creator Academy! 🎉
