-- Create the student projects showcase table
create table student_projects (
    id uuid default gen_random_uuid() primary key,
    student_name text not null,
    project_title text not null,
    image_url text not null,
    course_id uuid references courses(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: We are reusing the existing "course-images" storage bucket to make it easier for the admin, 
-- or they can create a new bucket if they prefer.

-- Set up Row Level Security (RLS)
alter table student_projects enable row level security;

-- Policies
-- Anyone can view projects (for the landing page)
create policy "Anyone can view student projects"
    on student_projects for select
    to public
    using (true);

-- Only admins can insert/update/delete projects
create policy "Admins can manage student projects"
    on student_projects for all
    to authenticated
    using (
        exists (
            select 1 from profiles
            where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
    );
