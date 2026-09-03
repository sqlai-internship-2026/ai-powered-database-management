INSERT INTO projects (id, name, description, start_date, end_date, budget, status) VALUES
(3000, 'Otonom Kesif Araci',          'Insansiz kara araci gelistirme programi',     '2023-01-10', '2026-06-30', 185000000.00, 'Devam Ediyor'),
(3001, 'Taktik Radar Sistemi',        'Mobil hava savunma radari gelistirme',        '2022-05-02', '2025-12-31', 240000000.00, 'Devam Ediyor'),
(3002, 'Sifreli Haberlesme Agi',      'Frekans atlamali telsiz altyapisi',           '2021-09-15', '2024-08-30',  95000000.00, 'Tamamlandi'),
(3003, 'Yer Kontrol Yazilimi',        'Operator konsolu ve gorev planlama yazilimi', '2024-02-01', '2026-12-31',  42000000.00, 'Devam Ediyor'),
(3004, 'Elektro-Optik Yuk Gelistirme','Gunduz/gece goruntuleme sistemi',             '2023-07-20', '2025-11-15',  68000000.00, 'Devam Ediyor'),
(3005, 'Seyir Fuzesi Navigasyon',     'INS/GNSS entegre navigasyon birimi',          '2020-03-01', '2023-10-31', 130000000.00, 'Tamamlandi'),
(3006, 'Insansiz Deniz Araci',        'Su ustu otonom platform on arastirmasi',      '2025-01-15', '2027-06-30',  55000000.00, 'Planlama');

SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));