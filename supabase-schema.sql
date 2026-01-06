-- ============================================
-- MAILLAYER SUPABASE DATABASE SCHEMA
-- Complete PostgreSQL schema for email marketing SaaS
-- Migrated from MongoDB/Mongoose to Supabase/PostgreSQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS / PROFILES TABLE
-- ============================================
-- Supabase Auth handles auth.users automatically
-- We extend it with a public.profiles table

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BRANDS TABLE
-- ============================================
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  verified_domain TEXT,
  
  -- SES Configuration
  aws_region TEXT DEFAULT 'us-east-1',
  aws_access_key_id TEXT,
  aws_secret_access_key TEXT,
  ses_sending_rate NUMERIC DEFAULT 10,
  ses_max_send_rate NUMERIC DEFAULT 200,
  ses_reputation_bounce_rate NUMERIC DEFAULT 0,
  ses_reputation_complaint_rate NUMERIC DEFAULT 0,
  
  -- Provider settings
  email_provider TEXT DEFAULT 'ses' CHECK (email_provider IN ('ses', 'sendgrid', 'mailgun', 'smtp')),
  
  -- SMTP settings
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  
  -- SendGrid
  sendgrid_api_key TEXT,
  
  -- Mailgun
  mailgun_api_key TEXT,
  mailgun_domain TEXT,
  
  -- SNS
  sns_topic_arn TEXT,
  sns_feedback_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_user_id ON public.brands(user_id);

-- ============================================
-- CONTACT LISTS TABLE
-- ============================================
CREATE TABLE public.contact_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_contacts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_lists_brand ON public.contact_lists(brand_id);
CREATE INDEX idx_contact_lists_user ON public.contact_lists(user_id);

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  
  -- Engagement metrics
  last_opened_at TIMESTAMPTZ,
  last_clicked_at TIMESTAMPTZ,
  email_opens_count INTEGER DEFAULT 0,
  email_clicks_count INTEGER DEFAULT 0,
  
  -- Custom fields stored as JSONB
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  -- Tags as array
  tags TEXT[],
  
  -- Segment tracking
  segment_ids UUID[],
  
  -- Metadata
  source TEXT,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(brand_id, email)
);

CREATE INDEX idx_contacts_brand ON public.contacts(brand_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_status ON public.contacts(status);
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags);
CREATE INDEX idx_contacts_custom_fields ON public.contacts USING GIN(custom_fields);

-- ============================================
-- CONTACT LIST MEMBERSHIPS (many-to-many)
-- ============================================
CREATE TABLE public.contact_list_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  contact_list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, contact_list_id)
);

CREATE INDEX idx_memberships_contact ON public.contact_list_memberships(contact_id);
CREATE INDEX idx_memberships_list ON public.contact_list_memberships(contact_list_id);

-- ============================================
-- SEGMENTS TABLE
-- ============================================
CREATE TABLE public.segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_type TEXT DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
  total_contacts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_brand ON public.segments(brand_id);

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT DEFAULT '',
  editor_mode TEXT DEFAULT 'visual' CHECK (editor_mode IN ('visual', 'html', 'react')),
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'warmup')),
  contact_list_ids UUID[],
  segment_ids UUID[],
  schedule_type TEXT DEFAULT 'send_now' CHECK (schedule_type IN ('send_now', 'schedule', 'warmup')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  stats_recipients INTEGER DEFAULT 0,
  stats_opens INTEGER DEFAULT 0,
  stats_clicks INTEGER DEFAULT 0,
  stats_bounces INTEGER DEFAULT 0,
  stats_complaints INTEGER DEFAULT 0,
  stats_unsubscribes INTEGER DEFAULT 0,
  warmup_config JSONB,
  track_opens BOOLEAN DEFAULT true,
  track_clicks BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_brand ON public.campaigns(brand_id);
CREATE INDEX idx_campaigns_user ON public.campaigns(user_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);

-- ============================================
-- EMAIL SEQUENCES TABLE
-- ============================================
CREATE TABLE public.email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT DEFAULT 'contact_list' CHECK (trigger_type IN ('contact_list', 'integration', 'webhook', 'manual')),
  trigger_config JSONB DEFAULT '{}'::jsonb,
  from_name TEXT,
  from_email TEXT,
  reply_to_email TEXT,
  status TEXT DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'archived')),
  total_enrolled INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  track_opens BOOLEAN DEFAULT true,
  track_clicks BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sequences_brand ON public.email_sequences(brand_id);
CREATE INDEX idx_sequences_status ON public.email_sequences(status);

-- ============================================
-- SEQUENCE STEPS TABLE
-- ============================================
CREATE TABLE public.sequence_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT DEFAULT '',
  editor_mode TEXT DEFAULT 'visual' CHECK (editor_mode IN ('visual', 'html', 'react')),
  delay_value INTEGER NOT NULL DEFAULT 0,
  delay_unit TEXT NOT NULL DEFAULT 'days' CHECK (delay_unit IN ('minutes', 'hours', 'days')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sequence_id, step_order)
);

CREATE INDEX idx_sequence_steps_sequence ON public.sequence_steps(sequence_id);

-- ============================================
-- SEQUENCE ENROLLMENTS TABLE
-- ============================================
CREATE TABLE public.sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed', 'unsubscribed')),
  current_step_index INTEGER DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, contact_id)
);

CREATE INDEX idx_enrollments_sequence ON public.sequence_enrollments(sequence_id);
CREATE INDEX idx_enrollments_contact ON public.sequence_enrollments(contact_id);
CREATE INDEX idx_enrollments_status ON public.sequence_enrollments(status);

-- ============================================
-- SEQUENCE LOGS TABLE
-- ============================================
CREATE TABLE public.sequence_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('enrolled', 'email_sent', 'email_opened', 'email_clicked', 'completed', 'failed', 'unsubscribed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sequence_logs_enrollment ON public.sequence_logs(enrollment_id);
CREATE INDEX idx_sequence_logs_action ON public.sequence_logs(action);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE(brand_id, email)
);

CREATE INDEX idx_team_members_brand ON public.team_members(brand_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);

-- ============================================
-- TRACKING EVENTS TABLE
-- ============================================
CREATE TABLE public.tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES public.email_sequences(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
  email TEXT,
  link_url TEXT,
  user_agent TEXT,
  ip_address INET,
  message_id TEXT,
  ses_event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_events_brand ON public.tracking_events(brand_id);
CREATE INDEX idx_tracking_events_contact ON public.tracking_events(contact_id);
CREATE INDEX idx_tracking_events_campaign ON public.tracking_events(campaign_id);
CREATE INDEX idx_tracking_events_type ON public.tracking_events(event_type);
CREATE INDEX idx_tracking_events_created ON public.tracking_events(created_at DESC);

-- ============================================
-- TRANSACTIONAL LOGS TABLE
-- ============================================
CREATE TABLE public.transactional_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT,
  template_id UUID,
  status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  message_id TEXT,
  ses_response JSONB,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_transactional_logs_brand ON public.transactional_logs(brand_id);
CREATE INDEX idx_transactional_logs_status ON public.transactional_logs(status);
CREATE INDEX idx_transactional_logs_sent ON public.transactional_logs(sent_at DESC);

-- ============================================
-- INTEGRATIONS TABLE
-- ============================================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('stripe', 'shopify', 'woocommerce', 'webhook', 'zapier')),
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integrations_brand ON public.integrations(brand_id);
CREATE INDEX idx_integrations_type ON public.integrations(integration_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_list_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Brands: Users can only access their own brands
CREATE POLICY "Users can view own brands" ON public.brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own brands" ON public.brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brands" ON public.brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brands" ON public.brands FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables (contacts, campaigns, sequences, etc.)
-- Each table should have policies that check user_id or brand ownership

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON public.contact_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_sequences_updated_at BEFORE UPDATE ON public.email_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sequence_steps_updated_at BEFORE UPDATE ON public.sequence_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTES FOR IMPLEMENTATION
-- ============================================
-- 1. Run this schema in Supabase SQL Editor
-- 2. Add more specific RLS policies based on your multi-tenant requirements
-- 3. Consider adding more indexes based on your query patterns
-- 4. Implement proper backup and monitoring strategies
-- 5. Use Supabase Storage for file uploads (email attachments, assets)
-- 6. Configure Supabase Auth providers (email/password, Google, etc.)
-- 7. Set up Vercel KV for rate limiting and temporary caching
