-- Which subsystems each program consumes, and how many of them. Multiplied by
-- products.unit_cost this gives the estimated hardware cost of a program, which
-- is a much smaller figure than its budget - the budget also covers labour,
-- test infrastructure and certification.
INSERT INTO project_products (project_id, product_id, quantity) VALUES
-- Autonomous Reconnaissance Vehicle
(3000, 4000,  3),
(3000, 4001,  3),
(3000, 4002,  6),
(3000, 4004,  3),
(3000, 4007,  3),
(3000, 4024,  6),
(3000, 4027,  3),
-- Tactical Radar System
(3001, 4004,  4),
(3001, 4009, 12),
(3001, 4010,  2),
(3001, 4017,  2),
(3001, 4018,  6),
(3001, 4019,  4),
-- Encrypted Communication Network
(3002, 4005, 25),
(3002, 4007,  8),
(3002, 4022, 10),
(3002, 4028,  6),
-- Ground Control Software
(3003, 4006,  5),
(3003, 4019, 10),
(3003, 4022,  5),
(3003, 4026,  5),
-- Electro-Optical Payload
(3004, 4001, 10),
(3004, 4011,  8),
(3004, 4012,  6),
(3004, 4021, 12),
-- Cruise Missile Navigation
(3005, 4003, 15),
(3005, 4004, 15),
(3005, 4007, 15),
(3005, 4021, 20),
-- Unmanned Surface Vehicle
(3006, 4002,  2),
(3006, 4003,  2),
(3006, 4020,  8),
(3006, 4024,  4),
-- Loitering Munition System
(3007, 4001, 20),
(3007, 4004, 20),
(3007, 4020, 40),
(3007, 4025, 20),
(3007, 4029, 30),
-- Naval Fire Control System
(3008, 4009,  8),
(3008, 4012,  4),
(3008, 4013,  2),
(3008, 4016,  4),
(3008, 4019,  8),
(3008, 4031,  1),
-- Satellite Ground Terminal
(3009, 4015,  6),
(3009, 4017,  6),
(3009, 4018,  8),
(3009, 4019,  6),
(3009, 4022,  6),
-- Armored Vehicle Modernization
(3010, 4000, 12),
(3010, 4007, 24),
(3010, 4008, 12),
(3010, 4020, 48),
(3010, 4024, 12),
-- Air Defense Command Centre
(3011, 4006,  4),
(3011, 4016,  8),
(3011, 4018, 12),
(3011, 4019, 24),
(3011, 4022, 16),
(3011, 4026,  8),
-- Radar Signal Processing Upgrade
(3012, 4009, 20),
(3012, 4021, 30),
(3012, 4022,  4),
-- Electronic Warfare Suite
(3013, 4007,  8),
(3013, 4010,  4),
(3013, 4013,  4),
(3013, 4021, 24),
(3013, 4030,  6),
-- Secure Data Diode
(3014, 4021, 10),
(3014, 4022,  8),
(3014, 4028,  4),
-- Turret Stabilization Redesign
(3015, 4007,  6),
(3015, 4008,  6),
(3015, 4024,  6),
-- Composite Airframe Research
(3016, 4029, 20),
(3016, 4030,  4),
-- Hypersonic Test Bench
(3017, 4021, 16),
(3017, 4023,  3),
(3017, 4025,  6),
(3017, 4031,  2),
-- Counter-Drone Radar
(3018, 4009,  6),
(3018, 4010,  2),
(3018, 4012,  3),
(3018, 4017,  2),
(3018, 4019,  2),
-- Mission Computer Refresh
(3019, 4004, 25),
(3019, 4021, 25),
(3019, 4027, 10),
-- Soldier Radio Modernization
(3020, 4005, 60),
(3020, 4020, 80),
(3020, 4028, 10),
-- Maritime Surveillance Payload
(3021, 4001,  4),
(3021, 4011,  4),
(3021, 4012,  2),
(3021, 4015,  2),
(3021, 4027,  2);
