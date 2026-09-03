CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    job_title VARCHAR(100),
    department_id INTEGER REFERENCES departments(id),
    hire_date DATE,
    salary NUMERIC(12,2)
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    budget NUMERIC(15,2),
    status VARCHAR(50)
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    unit_cost NUMERIC(15,2)
);

CREATE TABLE investments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    investment_type VARCHAR(100),
    amount NUMERIC(15,2) NOT NULL,
    investment_date DATE
);

CREATE TABLE project_employees (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    role_in_project VARCHAR(100),
    PRIMARY KEY (project_id, employee_id)
);

CREATE TABLE project_products (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY (project_id, product_id)
);