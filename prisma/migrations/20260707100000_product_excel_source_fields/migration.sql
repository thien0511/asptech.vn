ALTER TABLE "Product" ADD COLUMN "supplierName" TEXT;
ALTER TABLE "Product" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceWebsite" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceDocumentFolder" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceImageSpecFolder" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "legacyExcelStt" INTEGER;

CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");
CREATE UNIQUE INDEX "Product_model_manufacturerId_key" ON "Product"("model", "manufacturerId");
