-- Preserve the limit promised when a rewarded ad starts. Existing pending
-- attempts were created under the original three-hint limit.
ALTER TABLE ad_attempts ADD COLUMN round_limit INTEGER NOT NULL DEFAULT 3 CHECK(round_limit BETWEEN 1 AND 3);
