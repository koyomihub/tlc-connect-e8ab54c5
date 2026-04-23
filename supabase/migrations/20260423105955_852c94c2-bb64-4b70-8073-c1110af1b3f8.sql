
-- Add per-organization roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'officer_cs';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher_cs';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'officer_fec';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher_fec';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'officer_ybc';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher_ybc';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'officer_sc';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher_sc';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'officer_tl';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher_tl';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'officer_tlc';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher_tlc';
