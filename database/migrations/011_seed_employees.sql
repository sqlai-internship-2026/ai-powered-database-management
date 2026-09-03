INSERT INTO employees (id, first_name, last_name, email, job_title, department_id, hire_date, salary) VALUES
(2000, 'Ahmet',  'Yilmaz',  'ahmet.yilmaz@firma.com',  'Yazilim Muhendisi',         1000, '2021-03-15',  65000.00),
(2001, 'Elif',   'Kaya',    'elif.kaya@firma.com',     'Kidemli Yazilim Muhendisi', 1000, '2019-07-01',  92000.00),
(2002, 'Burak',  'Celik',   'burak.celik@firma.com',   'Gomulu Yazilim Muhendisi',  1000, '2022-02-14',  58000.00),
(2003, 'Mehmet', 'Demir',   'mehmet.demir@firma.com',  'Sistem Muhendisi',          1001, '2020-01-20',  78000.00),
(2004, 'Zeynep', 'Sahin',   'zeynep.sahin@firma.com',  'Proje Yoneticisi',          1001, '2018-05-10', 105000.00),
(2005, 'Can',    'Ozturk',  'can.ozturk@firma.com',    'Uretim Teknisyeni',         1002, '2022-09-05',  48000.00),
(2006, 'Merve',  'Aydin',   'merve.aydin@firma.com',   'Uretim Sefi',               1002, '2017-04-03',  86000.00),
(2007, 'Deniz',  'Arslan',  'deniz.arslan@firma.com',  'Kalite Muhendisi',          1003, '2021-11-12',  71000.00),
(2008, 'Selin',  'Kurt',    'selin.kurt@firma.com',    'Test Muhendisi',            1003, '2023-01-09',  54000.00),
(2009, 'Emre',   'Dogan',   'emre.dogan@firma.com',    'Ar-Ge Muhendisi',           1004, '2020-08-17',  81000.00),
(2010, 'Gizem',  'Polat',   'gizem.polat@firma.com',   'Kidemli Arastirmaci',       1004, '2016-10-01', 112000.00),
(2011, 'Okan',   'Yildiz',  'okan.yildiz@firma.com',   'Satinalma Uzmani',          1005, '2022-06-20',  52000.00);

SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));