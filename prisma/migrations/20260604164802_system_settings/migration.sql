-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "ai_features_enabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "default_currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "default_registration_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_billing_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_sms_notifications" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
