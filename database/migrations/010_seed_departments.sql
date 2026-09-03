INSERT INTO departments (id, name, description) VALUES
(1000, 'Yazilim Gelistirme',  'Gomulu ve masaustu yazilim gelistirme birimi'),
(1001, 'Sistem Muhendisligi', 'Sistem tasarimi ve gereksinim yonetimi'),
(1002, 'Uretim',              'Montaj ve seri uretim hatlari'),
(1003, 'Kalite Guvence',      'Test, dogrulama ve kalite kontrol'),
(1004, 'Ar-Ge',               'Arastirma ve prototip gelistirme'),
(1005, 'Tedarik Zinciri',     'Satinalma ve stok yonetimi');

SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));