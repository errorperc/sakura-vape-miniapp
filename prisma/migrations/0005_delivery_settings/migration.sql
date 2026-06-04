CREATE TABLE "shop_settings" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("key")
);
