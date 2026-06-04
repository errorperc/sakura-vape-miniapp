ALTER TABLE "products" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;

UPDATE "products"
SET "is_archived" = true
WHERE "is_active" = false;
