CREATE TABLE "categories" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

INSERT INTO "categories" ("id", "label")
VALUES
  ('disposable', 'Одноразки'),
  ('liquid', 'Жидкости'),
  ('pod', 'POD-системы'),
  ('cartridge', 'Картриджи'),
  ('accessory', 'Аксессуары')
ON CONFLICT ("id") DO UPDATE SET "label" = EXCLUDED."label";

ALTER TABLE "products" ADD COLUMN "accent" TEXT NOT NULL DEFAULT '#f52b88';
ALTER TABLE "products" ADD COLUMN "nicotine" TEXT NOT NULL DEFAULT '20 мг';
ALTER TABLE "products" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

ALTER TABLE "products" ADD CONSTRAINT "products_category_fkey"
  FOREIGN KEY ("category") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TYPE "ProductCategory";
