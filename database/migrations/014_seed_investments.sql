-- Investments are the money actually committed against a program, which is
-- what makes the budget-versus-actual reporting possible. Every row falls
-- inside its project's start and end date, and the totals per project are
-- deliberately uneven: most programs sit under budget, 3004 and 3010 ran over,
-- and the Planning ones have barely spent anything yet.
INSERT INTO investments (id, project_id, investment_type, amount, investment_date) VALUES
-- Autonomous Reconnaissance Vehicle
(5000, 3000, 'R&D Fund',           45000000.00, '2023-02-01'),
(5001, 3000, 'Equipment Purchase', 28000000.00, '2023-08-15'),
(5002, 3000, 'Personnel Cost',     32000000.00, '2024-01-10'),
(5003, 3000, 'Test Infrastructure', 6000000.00, '2024-11-08'),
(5004, 3000, 'Tooling',             4000000.00, '2025-05-19'),
-- Tactical Radar System
(5005, 3001, 'R&D Fund',           70000000.00, '2022-06-01'),
(5006, 3001, 'Test Infrastructure', 38000000.00, '2023-03-22'),
(5007, 3001, 'Equipment Purchase', 34000000.00, '2023-11-06'),
(5008, 3001, 'Personnel Cost',     29000000.00, '2024-07-15'),
(5009, 3001, 'Certification',       9000000.00, '2025-04-28'),
(5010, 3001, 'Subcontracting',      7000000.00, '2026-01-20'),
-- Encrypted Communication Network
(5011, 3002, 'R&D Fund',           40000000.00, '2021-10-05'),
(5012, 3002, 'Personnel Cost',     21000000.00, '2022-05-17'),
(5013, 3002, 'Equipment Purchase', 15000000.00, '2023-01-24'),
(5014, 3002, 'Certification',      12000000.00, '2024-02-18'),
(5015, 3002, 'Training',            3000000.00, '2024-06-11'),
-- Ground Control Software
(5016, 3003, 'Software License',    6500000.00, '2024-03-01'),
(5017, 3003, 'Personnel Cost',     11000000.00, '2024-09-12'),
(5018, 3003, 'Subcontracting',      4000000.00, '2025-06-03'),
(5019, 3003, 'Training',            1500000.00, '2026-02-16'),
-- Electro-Optical Payload (over budget)
(5020, 3004, 'Equipment Purchase', 22000000.00, '2023-09-05'),
(5021, 3004, 'R&D Fund',           25000000.00, '2024-04-20'),
(5022, 3004, 'Personnel Cost',     14000000.00, '2024-12-09'),
(5023, 3004, 'Test Infrastructure', 6000000.00, '2025-05-14'),
(5024, 3004, 'Certification',       3000000.00, '2025-10-02'),
-- Cruise Missile Navigation
(5025, 3005, 'R&D Fund',           60000000.00, '2020-04-15'),
(5026, 3005, 'Test Infrastructure', 31000000.00, '2021-11-30'),
(5027, 3005, 'Personnel Cost',     18000000.00, '2022-06-21'),
(5028, 3005, 'Equipment Purchase',  8000000.00, '2023-02-13'),
(5029, 3005, 'Certification',       3000000.00, '2023-09-26'),
-- Unmanned Surface Vehicle
(5030, 3006, 'Feasibility Study',   4000000.00, '2025-02-10'),
(5031, 3006, 'R&D Fund',            6000000.00, '2025-10-07'),
(5032, 3006, 'Personnel Cost',      3000000.00, '2026-04-22'),
-- Loitering Munition System
(5033, 3007, 'R&D Fund',           30000000.00, '2024-06-11'),
(5034, 3007, 'Equipment Purchase', 18000000.00, '2024-12-03'),
(5035, 3007, 'Personnel Cost',     15000000.00, '2025-07-29'),
(5036, 3007, 'Test Infrastructure', 6000000.00, '2026-02-05'),
(5037, 3007, 'Tooling',             3000000.00, '2026-08-18'),
-- Naval Fire Control System
(5038, 3008, 'R&D Fund',           78000000.00, '2019-05-20'),
(5039, 3008, 'Equipment Purchase', 45000000.00, '2020-02-11'),
(5040, 3008, 'Personnel Cost',     38000000.00, '2020-11-24'),
(5041, 3008, 'Test Infrastructure', 25000000.00, '2021-08-09'),
(5042, 3008, 'Subcontracting',     14000000.00, '2022-04-15'),
(5043, 3008, 'Certification',       8000000.00, '2022-12-06'),
-- Satellite Ground Terminal
(5044, 3009, 'R&D Fund',           24000000.00, '2022-12-13'),
(5045, 3009, 'Equipment Purchase', 19000000.00, '2023-07-18'),
(5046, 3009, 'Personnel Cost',     13000000.00, '2024-05-07'),
(5047, 3009, 'Certification',       6000000.00, '2025-03-25'),
(5048, 3009, 'Training',            4000000.00, '2026-01-14'),
-- Armored Vehicle Modernization (over budget)
(5049, 3010, 'Equipment Purchase', 62000000.00, '2021-03-16'),
(5050, 3010, 'Personnel Cost',     41000000.00, '2021-12-02'),
(5051, 3010, 'R&D Fund',           35000000.00, '2022-08-23'),
(5052, 3010, 'Tooling',            22000000.00, '2023-05-11'),
(5053, 3010, 'Facility Upgrade',   12000000.00, '2024-01-29'),
(5054, 3010, 'Certification',       8000000.00, '2024-10-17'),
-- Air Defense Command Centre
(5055, 3011, 'R&D Fund',           26000000.00, '2025-04-08'),
(5056, 3011, 'Software License',   12000000.00, '2025-11-19'),
(5057, 3011, 'Personnel Cost',     14000000.00, '2026-05-06'),
(5058, 3011, 'Equipment Purchase',  6000000.00, '2026-08-27'),
-- Radar Signal Processing Upgrade
(5059, 3012, 'R&D Fund',           11000000.00, '2024-10-15'),
(5060, 3012, 'Equipment Purchase',  8000000.00, '2025-04-02'),
(5061, 3012, 'Personnel Cost',      5000000.00, '2025-12-10'),
(5062, 3012, 'Test Infrastructure', 3000000.00, '2026-06-23'),
-- Electronic Warfare Suite
(5063, 3013, 'R&D Fund',           44000000.00, '2023-11-21'),
(5064, 3013, 'Equipment Purchase', 26000000.00, '2024-06-13'),
(5065, 3013, 'Personnel Cost',     21000000.00, '2025-02-04'),
(5066, 3013, 'Test Infrastructure', 12000000.00, '2025-09-16'),
(5067, 3013, 'Subcontracting',      8000000.00, '2026-03-31'),
-- Secure Data Diode
(5068, 3014, 'Feasibility Study',   2000000.00, '2025-07-09'),
(5069, 3014, 'R&D Fund',            4000000.00, '2026-01-27'),
(5070, 3014, 'Certification',       2000000.00, '2026-07-14'),
-- Turret Stabilization Redesign
(5071, 3015, 'R&D Fund',           18000000.00, '2022-09-27'),
(5072, 3015, 'Equipment Purchase', 11000000.00, '2023-04-18'),
(5073, 3015, 'Personnel Cost',      9000000.00, '2024-02-06'),
(5074, 3015, 'Test Infrastructure', 5000000.00, '2025-01-21'),
-- Composite Airframe Research
(5075, 3016, 'Feasibility Study',   2500000.00, '2026-02-03'),
(5076, 3016, 'R&D Fund',            2000000.00, '2026-07-21'),
-- Hypersonic Test Bench
(5077, 3017, 'Feasibility Study',   5000000.00, '2026-05-12'),
(5078, 3017, 'Facility Upgrade',    7000000.00, '2026-08-25'),
-- Counter-Drone Radar
(5079, 3018, 'R&D Fund',           20000000.00, '2024-02-20'),
(5080, 3018, 'Equipment Purchase', 14000000.00, '2024-09-10'),
(5081, 3018, 'Personnel Cost',      9000000.00, '2025-05-27'),
(5082, 3018, 'Test Infrastructure', 4000000.00, '2025-11-11'),
(5083, 3018, 'Certification',       3000000.00, '2026-04-07'),
-- Mission Computer Refresh
(5084, 3019, 'R&D Fund',           14000000.00, '2023-04-25'),
(5085, 3019, 'Equipment Purchase',  9000000.00, '2023-12-12'),
(5086, 3019, 'Personnel Cost',      7000000.00, '2024-08-20'),
(5087, 3019, 'Software License',    3000000.00, '2025-06-17'),
-- Soldier Radio Modernization
(5088, 3020, 'R&D Fund',           25000000.00, '2022-02-15'),
(5089, 3020, 'Equipment Purchase', 16000000.00, '2022-10-04'),
(5090, 3020, 'Personnel Cost',     12000000.00, '2023-06-19'),
(5091, 3020, 'Subcontracting',      5000000.00, '2024-03-08'),
(5092, 3020, 'Training',            3000000.00, '2024-11-26'),
-- Maritime Surveillance Payload
(5093, 3021, 'Feasibility Study',   3500000.00, '2025-10-14'),
(5094, 3021, 'R&D Fund',            5000000.00, '2026-06-09');

SELECT setval('investments_id_seq', (SELECT MAX(id) FROM investments));
