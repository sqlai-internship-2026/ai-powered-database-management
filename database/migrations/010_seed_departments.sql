INSERT INTO departments (id, name, description) VALUES
(1000, 'Software Development',     'Embedded and desktop software development unit'),
(1001, 'Systems Engineering',      'System design and requirements management'),
(1002, 'Production',               'Assembly and serial production lines'),
(1003, 'Quality Assurance',        'Testing, verification and quality control'),
(1004, 'Research and Development', 'Research and prototype development'),
(1005, 'Supply Chain',             'Procurement and inventory management'),
(1006, 'Test and Integration',     'Hardware-in-the-loop benches and field test campaigns'),
(1007, 'Program Management',       'Schedule, cost and customer milestone tracking'),
(1008, 'Information Security',     'Cryptographic approval and secure development oversight'),
(1009, 'Field Support',            'Deployment, operator training and in-service maintenance');

SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
