-- RECOVERED MIGRATION FILE
-- Historical migration name indicates removal of a redundant installment index.
-- The deleted index name is not recoverable from the live catalog.
-- The preceding reconstructed migration deliberately creates only the canonical
-- UNIQUE(deal_id, installment_no) constraint/index that exists in production.
-- Therefore no destructive or guessed DROP INDEX statement is emitted here.

select 1;
