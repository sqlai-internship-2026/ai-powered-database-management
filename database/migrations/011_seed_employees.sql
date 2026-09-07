-- Person names are data, not labels, so they stay as they are; only the
-- job_title column carries display text and is therefore English.
-- Salaries broadly follow seniority so the workforce reports have a spread
-- worth charting.
INSERT INTO employees (id, first_name, last_name, email, job_title, department_id, hire_date, salary) VALUES
-- Software Development
(2000, 'Ahmet',    'Yilmaz',   'ahmet.yilmaz@firma.com',     'Software Engineer',          1000, '2021-03-15',  65000.00),
(2001, 'Elif',     'Kaya',     'elif.kaya@firma.com',        'Senior Software Engineer',   1000, '2019-07-01',  92000.00),
(2002, 'Burak',    'Celik',    'burak.celik@firma.com',      'Embedded Software Engineer', 1000, '2022-02-14',  58000.00),
(2003, 'Selin',    'Aksoy',    'selin.aksoy@firma.com',      'Software Team Lead',         1000, '2018-09-24', 108000.00),
(2004, 'Kerem',    'Yalcin',   'kerem.yalcin@firma.com',     'Frontend Developer',         1000, '2023-04-03',  54000.00),
(2005, 'Pinar',    'Guler',    'pinar.guler@firma.com',      'Software Architect',         1000, '2016-11-07', 132000.00),
(2006, 'Onur',     'Tekin',    'onur.tekin@firma.com',       'Junior Software Engineer',   1000, '2025-02-10',  44000.00),
(2007, 'Ceren',    'Bulut',    'ceren.bulut@firma.com',      'Embedded Software Engineer', 1000, '2021-08-16',  67000.00),
(2008, 'Tolga',    'Ersoy',    'tolga.ersoy@firma.com',      'Software Engineer',          1000, '2022-10-11',  61000.00),
(2009, 'Sibel',    'Aktas',    'sibel.aktas@firma.com',      'Senior Software Engineer',   1000, '2020-05-18',  95000.00),
-- Systems Engineering
(2010, 'Mehmet',   'Demir',    'mehmet.demir@firma.com',     'Systems Engineer',           1001, '2020-01-20',  78000.00),
(2011, 'Zeynep',   'Sahin',    'zeynep.sahin@firma.com',     'Senior Systems Engineer',    1001, '2018-05-10', 105000.00),
(2012, 'Hakan',    'Ozdemir',  'hakan.ozdemir@firma.com',    'Requirements Engineer',      1001, '2021-06-28',  72000.00),
(2013, 'Nurdan',   'Kilic',    'nurdan.kilic@firma.com',     'Systems Architect',          1001, '2015-03-02', 138000.00),
(2014, 'Serkan',   'Avci',     'serkan.avci@firma.com',      'Systems Engineer',           1001, '2023-01-30',  69000.00),
(2015, 'Damla',    'Erdogan',  'damla.erdogan@firma.com',    'Requirements Engineer',      1001, '2024-07-15',  63000.00),
-- Production
(2016, 'Can',      'Ozturk',   'can.ozturk@firma.com',       'Production Technician',      1002, '2022-09-05',  48000.00),
(2017, 'Merve',    'Aydin',    'merve.aydin@firma.com',      'Production Supervisor',      1002, '2017-04-03',  86000.00),
(2018, 'Fatih',    'Korkmaz',  'fatih.korkmaz@firma.com',    'Manufacturing Engineer',     1002, '2019-11-25',  74000.00),
(2019, 'Gokhan',   'Simsek',   'gokhan.simsek@firma.com',    'Assembly Operator',          1002, '2023-06-12',  42000.00),
(2020, 'Ayse',     'Turan',    'ayse.turan@firma.com',       'Assembly Operator',          1002, '2024-02-19',  43000.00),
(2021, 'Emrah',    'Balci',    'emrah.balci@firma.com',      'Manufacturing Engineer',     1002, '2021-01-11',  71000.00),
(2022, 'Nihal',    'Ucar',     'nihal.ucar@firma.com',       'Production Technician',      1002, '2022-05-30',  49000.00),
(2023, 'Volkan',   'Ates',     'volkan.ates@firma.com',      'Production Supervisor',      1002, '2018-08-06',  88000.00),
-- Quality Assurance
(2024, 'Deniz',    'Arslan',   'deniz.arslan@firma.com',     'Quality Engineer',           1003, '2021-11-12',  71000.00),
(2025, 'Selin',    'Kurt',     'selin.kurt@firma.com',       'Test Engineer',              1003, '2023-01-09',  54000.00),
(2026, 'Baris',    'Yavuz',    'baris.yavuz@firma.com',      'Quality Manager',            1003, '2016-06-20', 124000.00),
(2027, 'Ipek',     'Sonmez',   'ipek.sonmez@firma.com',      'Configuration Manager',      1003, '2020-10-05',  79000.00),
(2028, 'Murat',    'Kocak',    'murat.kocak@firma.com',      'Quality Engineer',           1003, '2022-03-21',  68000.00),
(2029, 'Ebru',     'Tas',      'ebru.tas@firma.com',         'Test Engineer',              1003, '2024-09-02',  56000.00),
-- Research and Development
(2030, 'Emre',     'Dogan',    'emre.dogan@firma.com',       'R&D Engineer',               1004, '2020-08-17',  81000.00),
(2031, 'Gizem',    'Polat',    'gizem.polat@firma.com',      'Senior Researcher',          1004, '2016-10-01', 112000.00),
(2032, 'Levent',   'Ozkan',    'levent.ozkan@firma.com',     'Research Scientist',         1004, '2014-05-12', 152000.00),
(2033, 'Aylin',    'Cetin',    'aylin.cetin@firma.com',      'Prototype Engineer',         1004, '2022-07-25',  66000.00),
(2034, 'Yusuf',    'Karaca',   'yusuf.karaca@firma.com',     'R&D Engineer',               1004, '2023-11-13',  70000.00),
(2035, 'Melis',    'Aslan',    'melis.aslan@firma.com',      'Research Scientist',         1004, '2019-02-04', 118000.00),
-- Supply Chain
(2036, 'Okan',     'Yildiz',   'okan.yildiz@firma.com',      'Procurement Specialist',     1005, '2022-06-20',  52000.00),
(2037, 'Derya',    'Ozer',     'derya.ozer@firma.com',       'Logistics Coordinator',      1005, '2021-04-14',  55000.00),
(2038, 'Cem',      'Basaran',  'cem.basaran@firma.com',      'Inventory Planner',          1005, '2023-08-28',  51000.00),
(2039, 'Hande',    'Sen',      'hande.sen@firma.com',        'Supplier Quality Engineer',  1005, '2020-12-01',  73000.00),
(2040, 'Ufuk',     'Duran',    'ufuk.duran@firma.com',       'Procurement Specialist',     1005, '2024-03-11',  53000.00),
-- Test and Integration
(2041, 'Arda',     'Kaplan',   'arda.kaplan@firma.com',      'Integration Engineer',       1006, '2019-09-16',  84000.00),
(2042, 'Buse',     'Ergin',    'buse.ergin@firma.com',       'Field Test Engineer',        1006, '2021-07-05',  76000.00),
(2043, 'Sinan',    'Toprak',   'sinan.toprak@firma.com',     'HIL Test Engineer',          1006, '2022-11-21',  72000.00),
(2044, 'Ozge',     'Ilhan',    'ozge.ilhan@firma.com',       'Integration Engineer',       1006, '2023-03-27',  68000.00),
(2045, 'Kaan',     'Solmaz',   'kaan.solmaz@firma.com',      'Test Lab Technician',        1006, '2024-05-20',  47000.00),
(2046, 'Tugce',    'Bozkurt',  'tugce.bozkurt@firma.com',    'Field Test Engineer',        1006, '2020-02-24',  80000.00),
-- Program Management
(2047, 'Ali',      'Vural',    'ali.vural@firma.com',        'Project Manager',            1007, '2018-01-08', 115000.00),
(2048, 'Esra',     'Gunes',    'esra.gunes@firma.com',       'Senior Project Manager',     1007, '2015-09-14', 148000.00),
(2049, 'Mert',     'Sari',     'mert.sari@firma.com',        'Project Manager',            1007, '2020-06-15', 110000.00),
(2050, 'Nazli',    'Ozturk',   'nazli.ozturk@firma.com',     'Cost Control Analyst',       1007, '2022-04-04',  67000.00),
(2051, 'Halil',    'Kaya',     'halil.kaya@firma.com',       'Planning Engineer',          1007, '2021-10-18',  71000.00),
(2052, 'Sevgi',    'Altin',    'sevgi.altin@firma.com',      'Program Director',           1007, '2014-02-03', 165000.00),
-- Information Security
(2053, 'Tarik',    'Ozgur',    'tarik.ozgur@firma.com',      'Security Engineer',          1008, '2020-03-23',  89000.00),
(2054, 'Aysegul',  'Demirci',  'aysegul.demirci@firma.com',  'Cryptographic Analyst',      1008, '2018-11-19', 103000.00),
(2055, 'Emin',     'Sahin',    'emin.sahin@firma.com',       'Compliance Officer',         1008, '2022-08-08',  78000.00),
-- Field Support
(2056, 'Ozan',     'Cakir',    'ozan.cakir@firma.com',       'Field Service Engineer',     1009, '2021-05-24',  69000.00),
(2057, 'Filiz',    'Karaman',  'filiz.karaman@firma.com',    'Training Specialist',        1009, '2019-06-10',  64000.00),
(2058, 'Recep',    'Dogru',    'recep.dogru@firma.com',      'Maintenance Technician',     1009, '2023-09-18',  50000.00),
(2059, 'Neslihan', 'Ay',       'neslihan.ay@firma.com',       'Technical Writer',          1009, '2022-01-24',  58000.00);

SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));
