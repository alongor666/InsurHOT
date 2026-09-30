-- A per-unit price can be a per-token price (Jina bills the tokens of the page it returns, a fraction
-- of a millionth of a yuan each): six decimals would store it as zero.
ALTER TABLE service_prices ALTER COLUMN per_unit TYPE numeric(18, 10);
