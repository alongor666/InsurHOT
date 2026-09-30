-- ADR-015: a price row or a monthly limit is approved only by an admin with the owner role, from the
-- admin session. Nobody has the role after this migration, and no admin action grants it: whoever
-- operates the database does (UPDATE admin_users SET role = 'owner' WHERE ...), which is as far as a
-- database operator could already go by writing approved_by directly.
ALTER TABLE admin_users DROP CONSTRAINT admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'owner'));
