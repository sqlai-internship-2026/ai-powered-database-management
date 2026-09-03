INSERT INTO products (id, name, category, description, unit_cost) VALUES
(4000, 'Otonom Kara Araci Govdesi',   'Platform',    'Zirhli govde ve suspansiyon grubu',          1250000.00),
(4001, 'Elektro-Optik Kamera Modulu', 'Sensor',      'Gunduz/gece goruntuleme birimi',              420000.00),
(4002, 'LIDAR Sensor Birimi',         'Sensor',      '360 derece 3B tarama sensoru',                185000.00),
(4003, 'INS/GNSS Navigasyon Birimi',  'Aviyonik',    'Ataletsel navigasyon ve uydu konumlandirma',  310000.00),
(4004, 'Gorev Bilgisayari',           'Aviyonik',    'Gomulu gercek zamanli islem birimi',          145000.00),
(4005, 'Sifreli Telsiz Modulu',       'Haberlesme',  'Frekans atlamali sifreli veri baglantisi',    265000.00),
(4006, 'Yer Kontrol Istasyonu',       'Yer Sistemi', 'Tasinabilir operator konsolu',                680000.00),
(4007, 'Guc Dagitim Unitesi',         'Elektronik',  'Platform ici enerji yonetimi',                 75000.00),
(4008, 'Silah Stabilizasyon Sistemi', 'Platform',    'Iki eksenli stabilize kule',                  890000.00),
(4009, 'Radar Sinyal Islemci Karti',  'Elektronik',  'FPGA tabanli sinyal isleme karti',            230000.00);

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));