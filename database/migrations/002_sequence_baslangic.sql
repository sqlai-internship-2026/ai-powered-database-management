-- Prepares the tables for a seed run.
--
-- TRUNCATE first, so the whole batch can be re-applied after the seed data
-- changes instead of failing on a duplicate key. run_seeds.ps1 passes
-- --single-transaction, so this delete is rolled back together with the
-- INSERTs if any statement further down fails.
--
-- Every table that references another is listed in the same statement, which
-- is why no CASCADE is needed here.
TRUNCATE project_products,
         project_employees,
         investments,
         products,
         projects,
         employees,
         departments
    RESTART IDENTITY;

-- Each table gets its own id band so a record's origin is obvious while
-- reading raw rows: 1000s are departments, 2000s employees, and so on.
ALTER SEQUENCE departments_id_seq RESTART WITH 1000;
ALTER SEQUENCE employees_id_seq   RESTART WITH 2000;
ALTER SEQUENCE projects_id_seq    RESTART WITH 3000;
ALTER SEQUENCE products_id_seq    RESTART WITH 4000;
ALTER SEQUENCE investments_id_seq RESTART WITH 5000;
