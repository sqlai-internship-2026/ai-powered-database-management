"""Turkish -> English display labels.

The tables were seeded with Turkish text while the dashboard is English-only,
so stored values are translated on the way out of the API. The database itself
is left untouched. Values that are not in the map are returned unchanged, and
person names never go through it - a name is data, not a label.

When new rows are added to the database, add their text here as well;
otherwise they reach the UI in their original language.
"""

ENGLISH_LABELS = {
    # --- departments: name / description ---
    "Yazilim Gelistirme": "Software Development",
    "Gomulu ve masaustu yazilim gelistirme birimi": "Embedded and desktop software development unit",
    "Sistem Muhendisligi": "Systems Engineering",
    "Sistem tasarimi ve gereksinim yonetimi": "System design and requirements management",
    "Uretim": "Production",
    "Montaj ve seri uretim hatlari": "Assembly and serial production lines",
    "Kalite Guvence": "Quality Assurance",
    "Test, dogrulama ve kalite kontrol": "Testing, verification and quality control",
    "Ar-Ge": "Research and Development",
    "Arastirma ve prototip gelistirme": "Research and prototype development",
    "Tedarik Zinciri": "Supply Chain",
    "Satinalma ve stok yonetimi": "Procurement and inventory management",
    # --- employees: job_title ---
    "Yazilim Muhendisi": "Software Engineer",
    "Kidemli Yazilim Muhendisi": "Senior Software Engineer",
    "Gomulu Yazilim Muhendisi": "Embedded Software Engineer",
    "Sistem Muhendisi": "Systems Engineer",
    "Proje Yoneticisi": "Project Manager",
    "Uretim Teknisyeni": "Production Technician",
    "Uretim Sefi": "Production Supervisor",
    "Kalite Muhendisi": "Quality Engineer",
    "Test Muhendisi": "Test Engineer",
    "Ar-Ge Muhendisi": "R&D Engineer",
    "Kidemli Arastirmaci": "Senior Researcher",
    "Satinalma Uzmani": "Procurement Specialist",
    # --- projects: status ---
    # These three must stay in sync with the badge styles in StatusBadge.jsx.
    "Devam Ediyor": "Active",
    "Tamamlandi": "Completed",
    "Planlama": "Planning",
    # --- projects: name / description ---
    "Otonom Kesif Araci": "Autonomous Reconnaissance Vehicle",
    "Insansiz kara araci gelistirme programi": "Unmanned ground vehicle development program",
    "Taktik Radar Sistemi": "Tactical Radar System",
    "Mobil hava savunma radari gelistirme": "Mobile air defense radar development",
    "Sifreli Haberlesme Agi": "Encrypted Communication Network",
    "Frekans atlamali telsiz altyapisi": "Frequency hopping radio infrastructure",
    "Yer Kontrol Yazilimi": "Ground Control Software",
    "Operator konsolu ve gorev planlama yazilimi": "Operator console and mission planning software",
    "Elektro-Optik Yuk Gelistirme": "Electro-Optical Payload Development",
    "Gunduz/gece goruntuleme sistemi": "Day/night imaging system",
    "Seyir Fuzesi Navigasyon": "Cruise Missile Navigation",
    "INS/GNSS entegre navigasyon birimi": "INS/GNSS integrated navigation unit",
    "Insansiz Deniz Araci": "Unmanned Surface Vehicle",
    "Su ustu otonom platform on arastirmasi": "Preliminary research on an autonomous surface platform",
    # --- products: name / description ---
    "Otonom Kara Araci Govdesi": "Autonomous Ground Vehicle Hull",
    "Zirhli govde ve suspansiyon grubu": "Armored hull and suspension assembly",
    "Elektro-Optik Kamera Modulu": "Electro-Optical Camera Module",
    "Gunduz/gece goruntuleme birimi": "Day/night imaging unit",
    "LIDAR Sensor Birimi": "LIDAR Sensor Unit",
    "360 derece 3B tarama sensoru": "360 degree 3D scanning sensor",
    "INS/GNSS Navigasyon Birimi": "INS/GNSS Navigation Unit",
    "Ataletsel navigasyon ve uydu konumlandirma": "Inertial navigation and satellite positioning",
    "Gorev Bilgisayari": "Mission Computer",
    "Gomulu gercek zamanli islem birimi": "Embedded real-time processing unit",
    "Sifreli Telsiz Modulu": "Encrypted Radio Module",
    "Frekans atlamali sifreli veri baglantisi": "Frequency hopping encrypted data link",
    "Yer Kontrol Istasyonu": "Ground Control Station",
    "Tasinabilir operator konsolu": "Portable operator console",
    "Guc Dagitim Unitesi": "Power Distribution Unit",
    "Platform ici enerji yonetimi": "On-platform energy management",
    "Silah Stabilizasyon Sistemi": "Weapon Stabilization System",
    "Iki eksenli stabilize kule": "Two-axis stabilized turret",
    "Radar Sinyal Islemci Karti": "Radar Signal Processor Board",
    "FPGA tabanli sinyal isleme karti": "FPGA based signal processing board",
    # --- products: category ---
    "Sensor": "Sensor",
    "Aviyonik": "Avionics",
    "Haberlesme": "Communication",
    "Yer Sistemi": "Ground Systems",
    "Elektronik": "Electronics",
    # --- investments: investment_type ---
    "Ar-Ge Fonu": "R&D Fund",
    "Ekipman Alimi": "Equipment Purchase",
    "Personel Gideri": "Personnel Cost",
    "Test Altyapisi": "Test Infrastructure",
    "Sertifikasyon": "Certification",
    "Yazilim Lisansi": "Software License",
    "Fizibilite Calismasi": "Feasibility Study",
}

ACTIVE_STATUS = "Active"


def to_english(value):
    if value is None:
        return None
    return ENGLISH_LABELS.get(value, value)


def translate_rows(rows, fields):
    """Translates the given text fields of every row in place."""
    for row in rows:
        for field in fields:
            row[field] = to_english(row[field])
    return rows
