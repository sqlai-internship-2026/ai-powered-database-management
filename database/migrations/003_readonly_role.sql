-- ---------------------------------------------------------------------------
-- The read-only role that runs SQL a language model wrote.
--
-- Run it through the wrapper, which reads the password from .env:
--   powershell -ExecutionPolicy Bypass -File database\create_readonly_role.ps1
--
-- This file describes what the role holds rather than adding to it. Running it
-- again on a machine where the role already exists brings the role back to
-- exactly this state instead of failing, which is why it revokes before it
-- grants: a privilege somebody added by hand would otherwise survive every run.
--
-- The password is never written here. This file is committed and the password
-- is not, so it arrives through the environment as PG_READONLY_PASSWORD.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

\getenv readonly_user PG_READONLY_USER
\if :{?readonly_user}
\else
  \set readonly_user sqlai_readonly
\endif

\getenv readonly_password PG_READONLY_PASSWORD
\if :{?readonly_password}
\else
  \set readonly_password ''
\endif

SELECT length(:'readonly_password') > 0 AS has_readonly_password \gset
\if :has_readonly_password
\else
  DO $$ BEGIN RAISE EXCEPTION 'PG_READONLY_PASSWORD is empty. Set it in .env and run create_readonly_role.ps1 from the database folder.'; END $$;
\endif

-- CREATE ROLE has no IF NOT EXISTS, so it is issued only when the role is
-- missing. psql does not substitute variables inside a DO block, which is why
-- the conditional statements here are built with format() and run by \gexec.
SELECT format('CREATE ROLE %I LOGIN', :'readonly_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'readonly_user')
\gexec

-- Set rather than assumed. A role created by hand may carry any of these, and
-- none of them belongs on a role whose whole purpose is to be unable to act.
ALTER ROLE :"readonly_user" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- Every run, so changing PG_READONLY_PASSWORD in .env and running this again is
-- how the password is rotated.
ALTER ROLE :"readonly_user" PASSWORD :'readonly_password';

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'readonly_user')
\gexec

GRANT USAGE ON SCHEMA public TO :"readonly_user";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"readonly_user";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"readonly_user";

-- Tables the same owner creates later get SELECT as well, and nothing more.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM :"readonly_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO :"readonly_user";

-- The two settings that make the server, not the application, what stops a
-- slow or writing query. Both apply the moment the role connects.
ALTER ROLE :"readonly_user" SET statement_timeout = '5s';
ALTER ROLE :"readonly_user" SET default_transaction_read_only = on;

-- Read back from the catalog at the end of the same transaction, the way the
-- seed script prints row counts: what the role can do, not what was intended.
SELECT r.rolname     AS role,
       r.rolcanlogin AS can_login,
       r.rolsuper    AS superuser,
       r.rolconfig   AS settings,
       (SELECT count(*) FROM information_schema.role_table_grants g
         WHERE g.grantee = r.rolname AND g.privilege_type = 'SELECT')  AS readable_tables,
       (SELECT count(*) FROM information_schema.role_table_grants g
         WHERE g.grantee = r.rolname AND g.privilege_type <> 'SELECT') AS other_privileges
FROM pg_roles r
WHERE r.rolname = :'readonly_user';
