-- Business Partner — Microsoft Azure SQL Database Schema
-- Broker & Referral System — Single Source of Truth
-- All automation, data, and communication through Azure exclusively

-- Enable Azure AD authentication
-- Execute as Azure AD admin:
-- CREATE USER [business-partner-identity] FROM EXTERNAL PROVIDER;
-- ALTER ROLE db_owner ADD MEMBER [business-partner-identity];

-- =====================================================================
-- Brokers Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS brokers (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  email NVARCHAR(254) NOT NULL UNIQUE,
  phone NVARCHAR(20),
  password_hash NVARCHAR(255),
  full_name NVARCHAR(255),
  company_name NVARCHAR(255),
  company_url NVARCHAR(500),
  profile_image_url NVARCHAR(500),
  bio NVARCHAR(2000),

  -- Contact & Location
  country NVARCHAR(2),
  city NVARCHAR(100),
  address NVARCHAR(500),

  -- Bank Details (encrypted in Azure Key Vault)
  bank_account_holder NVARCHAR(255),
  bank_account_number NVARCHAR(50),
  bank_iban NVARCHAR(50),
  bank_swift NVARCHAR(20),

  -- Payout Configuration
  payout_currency NVARCHAR(3) DEFAULT 'SAR',
  payout_method NVARCHAR(50), -- 'bank_transfer', 'paypal', 'stripe'
  payout_frequency NVARCHAR(50), -- 'monthly', 'quarterly'

  -- Commission Plan
  commission_plan_id NVARCHAR(36),
  tier_level INT DEFAULT 0,

  -- Status & Verification
  status NVARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'suspended', 'inactive'
  email_verified BIT DEFAULT 0,
  phone_verified BIT DEFAULT 0,
  kyc_verified BIT DEFAULT 0,
  kyc_document_url NVARCHAR(500),

  -- Agreement
  agreement_version NVARCHAR(50),
  agreement_accepted_at DATETIME2,
  agreement_accepted_ip NVARCHAR(45),

  -- Audit
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),
  last_login_at DATETIME2,

  -- Notification Preferences
  notify_new_referral BIT DEFAULT 1,
  notify_commission_pending BIT DEFAULT 1,
  notify_payout_processed BIT DEFAULT 1,

  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- =====================================================================
-- Referrals Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS referrals (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  broker_id NVARCHAR(36) NOT NULL,

  -- Company Information
  company_name NVARCHAR(255) NOT NULL,
  company_url NVARCHAR(500),
  company_domain NVARCHAR(255),
  company_crn NVARCHAR(50),
  company_industry NVARCHAR(100),
  company_size NVARCHAR(50),

  -- Contact Information
  contact_name NVARCHAR(255),
  contact_email NVARCHAR(254) NOT NULL,
  contact_phone NVARCHAR(20),
  contact_title NVARCHAR(100),

  -- Referral Details
  referral_source NVARCHAR(100), -- 'form', 'email', 'whatsapp', 'phone'
  referral_message NVARCHAR(2000),

  -- Deal & Value
  deal_value_expected DECIMAL(15, 2),
  deal_value_actual DECIMAL(15, 2),
  deal_currency NVARCHAR(3) DEFAULT 'SAR',

  -- Status
  status NVARCHAR(50) DEFAULT 'new', -- 'new', 'in_progress', 'qualified', 'won', 'lost', 'duplicate'
  stage NVARCHAR(100), -- 'lead', 'opportunity', 'negotiation', 'customer'

  -- Company Conversion
  company_became_customer BIT DEFAULT 0,
  company_signup_date DATETIME2,
  company_signup_reference NVARCHAR(50),

  -- Deduplication
  dedupe_key NVARCHAR(500) UNIQUE,
  dedupe_match_id NVARCHAR(36), -- Links to duplicate referral

  -- Audit
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),
  closed_at DATETIME2,

  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE,
  INDEX idx_broker_id (broker_id),
  INDEX idx_status (status),
  INDEX idx_stage (stage),
  INDEX idx_created_at (created_at),
  INDEX idx_dedupe_key (dedupe_key)
);

-- =====================================================================
-- Commission Plans (Tiers)
-- =====================================================================
CREATE TABLE IF NOT EXISTS commission_plans (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(2000),
  tier_level INT NOT NULL UNIQUE,

  -- Commission Rates
  first_invoice_rate DECIMAL(5, 2) DEFAULT 10.00, -- % of first invoice
  renewal_rate DECIMAL(5, 2) DEFAULT 5.00,         -- % of renewal invoices
  service_rate DECIMAL(5, 2),                       -- % of service revenue

  -- Tier Requirements
  min_broker_referrals INT DEFAULT 0,
  min_total_value DECIMAL(15, 2),
  min_closed_deals INT DEFAULT 0,

  -- Bonus Structure
  performance_bonus_enabled BIT DEFAULT 0,
  bonus_threshold_value DECIMAL(15, 2),
  bonus_percentage DECIMAL(5, 2),

  -- Status
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),

  INDEX idx_tier_level (tier_level)
);

-- =====================================================================
-- Referral Commissions (Ledger)
-- =====================================================================
CREATE TABLE IF NOT EXISTS referral_commissions (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  referral_id NVARCHAR(36) NOT NULL,
  broker_id NVARCHAR(36) NOT NULL,

  -- Commission Calculation
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,

  invoice_number NVARCHAR(50),
  invoice_date DATE,
  invoice_amount DECIMAL(15, 2),
  invoice_currency NVARCHAR(3) DEFAULT 'SAR',

  commission_rate DECIMAL(5, 2),
  commission_amount DECIMAL(15, 2),

  -- Tax & Withholding
  tax_withheld DECIMAL(15, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2),

  net_commission DECIMAL(15, 2),

  -- Status
  status NVARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'disputed'
  decision_date DATETIME2,
  decision_by NVARCHAR(254),
  decision_notes NVARCHAR(2000),

  -- Payout Link
  payout_id NVARCHAR(36),

  -- Audit
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),

  FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE,
  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE,
  INDEX idx_broker_id (broker_id),
  INDEX idx_referral_id (referral_id),
  INDEX idx_status (status),
  INDEX idx_period (period_start_date, period_end_date)
);

-- =====================================================================
-- Broker Payouts (Payment Ledger)
-- =====================================================================
CREATE TABLE IF NOT EXISTS broker_payouts (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  broker_id NVARCHAR(36) NOT NULL,

  -- Payout Details
  payout_date DATE NOT NULL,
  payment_method NVARCHAR(50), -- 'bank_transfer', 'paypal', 'stripe'

  -- Amount
  total_gross DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  currency NVARCHAR(3) DEFAULT 'SAR',

  -- Payment Reference
  payment_reference NVARCHAR(100) UNIQUE,
  bank_transaction_id NVARCHAR(100),

  -- Commission Inclusions
  commission_count INT,
  commission_period_start DATE,
  commission_period_end DATE,

  -- Status
  status NVARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'reversed'
  payment_timestamp DATETIME2,
  failure_reason NVARCHAR(500),

  -- Audit
  created_at DATETIME2 DEFAULT GETUTCDATE(),
  updated_at DATETIME2 DEFAULT GETUTCDATE(),
  created_by NVARCHAR(254),

  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE,
  INDEX idx_broker_id (broker_id),
  INDEX idx_status (status),
  INDEX idx_payout_date (payout_date)
);

-- =====================================================================
-- Referral Events (Audit Trail)
-- =====================================================================
CREATE TABLE IF NOT EXISTS referral_events (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  referral_id NVARCHAR(36),
  broker_id NVARCHAR(36),

  event_type NVARCHAR(100), -- 'created', 'status_changed', 'customer_signup', 'commission_calculated', 'payout_processed'
  event_data NVARCHAR(MAX), -- JSON payload

  triggered_by NVARCHAR(254), -- email or 'system'
  ip_address NVARCHAR(45),
  user_agent NVARCHAR(500),

  created_at DATETIME2 DEFAULT GETUTCDATE(),

  FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE,
  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE,
  INDEX idx_referral_id (referral_id),
  INDEX idx_broker_id (broker_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
);

-- =====================================================================
-- Broker Sessions (Authentication)
-- =====================================================================
CREATE TABLE IF NOT EXISTS broker_sessions (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  broker_id NVARCHAR(36) NOT NULL,

  session_token_hash NVARCHAR(64) NOT NULL UNIQUE,
  otp_code NVARCHAR(6),
  otp_attempts INT DEFAULT 0,
  otp_expires_at DATETIME2,

  ip_address NVARCHAR(45),
  user_agent NVARCHAR(500),

  last_activity_at DATETIME2,
  expires_at DATETIME2,
  revoked_at DATETIME2,

  created_at DATETIME2 DEFAULT GETUTCDATE(),

  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE CASCADE,
  INDEX idx_broker_id (broker_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_revoked_at (revoked_at)
);

-- =====================================================================
-- Notification Queue (Azure Communication Services)
-- =====================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
  broker_id NVARCHAR(36),

  notification_type NVARCHAR(50), -- 'email', 'sms', 'push'
  recipient_address NVARCHAR(254),
  recipient_phone NVARCHAR(20),

  subject NVARCHAR(255),
  body NVARCHAR(MAX),
  template_name NVARCHAR(100),
  template_data NVARCHAR(MAX), -- JSON

  -- Azure Communication Services
  azure_message_id NVARCHAR(100),
  azure_status NVARCHAR(50), -- 'queued', 'sent', 'delivered', 'failed'

  status NVARCHAR(50) DEFAULT 'pending',
  sent_at DATETIME2,
  delivery_status_at DATETIME2,
  error_message NVARCHAR(1000),

  created_at DATETIME2 DEFAULT GETUTCDATE(),

  FOREIGN KEY (broker_id) REFERENCES brokers(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- =====================================================================
-- Audit Logs (Compliance & Security)
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),

  action NVARCHAR(100),
  resource_type NVARCHAR(50), -- 'broker', 'referral', 'commission', 'payout'
  resource_id NVARCHAR(36),

  performed_by NVARCHAR(254),
  performed_at DATETIME2,

  changes NVARCHAR(MAX), -- JSON with before/after
  ip_address NVARCHAR(45),
  user_agent NVARCHAR(500),

  created_at DATETIME2 DEFAULT GETUTCDATE(),

  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at)
);

-- =====================================================================
-- Create Default Commission Plans
-- =====================================================================
INSERT INTO commission_plans (tier_level, name, first_invoice_rate, renewal_rate, min_broker_referrals, is_active)
VALUES
  (0, 'Bronze', 10.00, 5.00, 0, 1),
  (1, 'Silver', 12.00, 6.00, 5, 1),
  (2, 'Gold', 15.00, 8.00, 15, 1),
  (3, 'Platinum', 20.00, 10.00, 30, 1);

-- =====================================================================
-- Create Indexes for Performance
-- =====================================================================
CREATE INDEX idx_referrals_broker_status ON referrals(broker_id, status);
CREATE INDEX idx_commissions_broker_status ON referral_commissions(broker_id, status);
CREATE INDEX idx_commissions_period ON referral_commissions(period_start_date, period_end_date);
CREATE INDEX idx_payouts_broker_status ON broker_payouts(broker_id, status);
