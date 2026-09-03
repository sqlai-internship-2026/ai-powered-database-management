INSERT INTO investments (id, project_id, investment_type, amount, investment_date) VALUES
(5000, 3000, 'Ar-Ge Fonu',           45000000.00, '2023-02-01'),
(5001, 3000, 'Ekipman Alimi',        28000000.00, '2023-08-15'),
(5002, 3000, 'Personel Gideri',      32000000.00, '2024-01-10'),
(5003, 3001, 'Ar-Ge Fonu',           70000000.00, '2022-06-01'),
(5004, 3001, 'Test Altyapisi',       38000000.00, '2023-03-22'),
(5005, 3002, 'Ar-Ge Fonu',           40000000.00, '2021-10-05'),
(5006, 3002, 'Sertifikasyon',        12000000.00, '2024-02-18'),
(5007, 3003, 'Yazilim Lisansi',       6500000.00, '2024-03-01'),
(5008, 3003, 'Personel Gideri',      18000000.00, '2024-09-12'),
(5009, 3004, 'Ekipman Alimi',        22000000.00, '2023-09-05'),
(5010, 3004, 'Ar-Ge Fonu',           25000000.00, '2024-04-20'),
(5011, 3005, 'Ar-Ge Fonu',           60000000.00, '2020-04-15'),
(5012, 3005, 'Test Altyapisi',       31000000.00, '2021-11-30'),
(5013, 3006, 'Fizibilite Calismasi',  4000000.00, '2025-02-10');

SELECT setval('investments_id_seq', (SELECT MAX(id) FROM investments));