-- CreateTable
CREATE TABLE "SearchCache" (
    "key" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("key")
);

-- Fast food search at scale --------------------------------------------------
-- "search_key" is brand + name, lowercased with everything but letters and
-- digits removed ("Chick-fil-A Sauce" → "chickfilasauce"). A trigger keeps it
-- current, and a trigram index makes LIKE '%chickfila%' fast on millions of rows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Food" ADD COLUMN "search_key" TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION food_search_key() RETURNS trigger AS $$
BEGIN
  NEW."search_key" := regexp_replace(lower(coalesce(NEW."brand", '') || NEW."name"), '[^a-z0-9]', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER food_search_key_trigger
BEFORE INSERT OR UPDATE OF "name", "brand" ON "Food"
FOR EACH ROW EXECUTE FUNCTION food_search_key();

UPDATE "Food" SET "search_key" = regexp_replace(lower(coalesce("brand", '') || "name"), '[^a-z0-9]', '', 'g');

CREATE INDEX "Food_search_key_trgm" ON "Food" USING GIN ("search_key" gin_trgm_ops);
