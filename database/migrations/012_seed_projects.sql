-- Status is one of Active, Completed, Planning or On Hold - the four values the
-- StatusBadge component styles. Completed programs have an end_date in the
-- past, Planning ones have not started yet.
INSERT INTO projects (id, name, description, start_date, end_date, budget, status) VALUES
(3000, 'Autonomous Reconnaissance Vehicle', 'Unmanned ground vehicle development program',              '2023-01-10', '2027-06-30', 185000000.00, 'Active'),
(3001, 'Tactical Radar System',             'Mobile air defense radar development',                     '2022-05-02', '2026-12-31', 240000000.00, 'Active'),
(3002, 'Encrypted Communication Network',   'Frequency hopping tactical radio infrastructure',          '2021-09-15', '2024-08-30',  95000000.00, 'Completed'),
(3003, 'Ground Control Software',           'Operator console and mission planning software',           '2024-02-01', '2026-12-31',  42000000.00, 'Active'),
(3004, 'Electro-Optical Payload',           'Day and night imaging system for aerial platforms',        '2023-07-20', '2025-11-15',  68000000.00, 'Completed'),
(3005, 'Cruise Missile Navigation',         'Integrated inertial and satellite navigation unit',        '2020-03-01', '2023-10-31', 130000000.00, 'Completed'),
(3006, 'Unmanned Surface Vehicle',          'Autonomous surface platform development',                  '2025-01-15', '2028-06-30',  55000000.00, 'Active'),
(3007, 'Loitering Munition System',         'Man-portable loitering munition with electro-optical seeker', '2024-05-06', '2027-09-30', 156000000.00, 'Active'),
(3008, 'Naval Fire Control System',         'Shipborne gun and missile fire control suite',             '2019-04-01', '2023-03-31', 210000000.00, 'Completed'),
(3009, 'Satellite Ground Terminal',         'Deployable Ka-band satellite communication terminal',      '2022-11-14', '2026-05-29',  74000000.00, 'Completed'),
(3010, 'Armored Vehicle Modernization',     'Powerpack and turret retrofit for the legacy fleet',       '2021-02-08', '2024-12-20', 168000000.00, 'Completed'),
(3011, 'Air Defense Command Centre',        'Integrated air picture and engagement management',         '2025-03-03', '2029-02-28', 320000000.00, 'Active'),
(3012, 'Radar Signal Processing Upgrade',   'FPGA based receiver refresh for fielded radars',           '2024-09-02', '2026-11-30',  38000000.00, 'Active'),
(3013, 'Electronic Warfare Suite',          'Self-protection jammer for rotary wing platforms',         '2023-10-16', '2027-04-30', 195000000.00, 'Active'),
(3014, 'Secure Data Diode',                 'One-way gateway for cross-domain data transfer',           '2025-06-02', '2027-05-31',  24000000.00, 'Active'),
(3015, 'Turret Stabilization Redesign',     'Two-axis stabilization accuracy improvement',              '2022-08-22', '2025-06-30',  46000000.00, 'Completed'),
(3016, 'Composite Airframe Research',       'Lightweight composite structures for unmanned platforms',  '2026-01-12', '2029-06-30',  88000000.00, 'Planning'),
(3017, 'Hypersonic Test Bench',             'Ground test infrastructure for high speed propulsion',     '2026-04-01', '2030-03-31', 420000000.00, 'Planning'),
(3018, 'Counter-Drone Radar',               'Short range detection and classification of small targets', '2024-01-08', '2026-10-30',  62000000.00, 'Active'),
(3019, 'Mission Computer Refresh',          'Next generation embedded processing module',               '2023-03-13', '2026-02-27',  34000000.00, 'Completed'),
(3020, 'Soldier Radio Modernization',       'Software defined handheld radio for dismounted units',     '2022-01-17', '2026-03-31', 118000000.00, 'On Hold'),
(3021, 'Maritime Surveillance Payload',     'Wide area maritime search sensor package',                 '2025-09-01', '2028-08-31',  97000000.00, 'On Hold');

SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));
