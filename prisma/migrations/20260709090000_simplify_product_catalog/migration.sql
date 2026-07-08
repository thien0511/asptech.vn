ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_manufacturerId_fkey";

DROP INDEX IF EXISTS "Product_code_key";
DROP INDEX IF EXISTS "Product_manufacturerId_idx";
DROP INDEX IF EXISTS "Product_model_manufacturerId_key";

ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "code",
  DROP COLUMN IF EXISTS "model",
  DROP COLUMN IF EXISTS "summary",
  DROP COLUMN IF EXISTS "supplierName",
  DROP COLUMN IF EXISTS "sourceWebsite",
  DROP COLUMN IF EXISTS "sourceDocumentFolder",
  DROP COLUMN IF EXISTS "sourceImageSpecFolder",
  DROP COLUMN IF EXISTS "sourceUpdatedAt",
  DROP COLUMN IF EXISTS "legacyExcelStt",
  DROP COLUMN IF EXISTS "manufacturerId";

DROP TABLE IF EXISTS "Manufacturer";
