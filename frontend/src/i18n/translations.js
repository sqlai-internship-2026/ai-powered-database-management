// The Turkish reading of every phrase the interface says.
//
// Keys are the English text itself rather than invented identifiers, so a
// screen reads the same in the source whichever language is on: t('Budget')
// is still legible next to the markup it labels, and a phrase that has no
// entry here falls back to its own key - English - instead of printing a
// missing token. That also means English needs no dictionary of its own.
//
// Placeholders are {name} and are filled by the caller, never by the
// translation, because word order differs between the two languages and a
// sentence assembled from fragments would only be correct in one of them.
//
// Row values are data and stay as the database stores them, with one
// exception: the closed sets that are read as labels rather than as names -
// project status, investment type, product category, audit severity and risk.
// Those sit at the bottom of the file. Names of people, programs, products and
// departments, and the descriptions beside them, are never translated.

const tr = {
  /* ---------- Shell, navigation, identity ---------- */

  'Management System': 'Yönetim Sistemi',
  'Main navigation': 'Ana gezinme',
  Breadcrumb: 'Gezinme yolu',
  'Open the navigation menu': 'Gezinme menüsünü aç',
  'Close the navigation menu': 'Gezinme menüsünü kapat',
  'Expand the sidebar': 'Kenar çubuğunu genişlet',
  'Collapse the sidebar': 'Kenar çubuğunu daralt',
  Collapse: 'Daralt',
  'Log out': 'Çıkış yap',
  'Signed in as': 'Oturum açan',
  'Switch to dark theme': 'Koyu temaya geç',
  'Switch to light theme': 'Açık temaya geç',
  'Switch to Turkish': "Türkçe'ye geç",
  'Switch to English': "İngilizce'ye geç",
  'Not found': 'Bulunamadı',
  'Unknown user': 'Bilinmeyen kullanıcı',

  Overview: 'Genel Bakış',
  'Management data': 'Yönetim verileri',
  'Analysis and AI': 'Analiz ve yapay zeka',
  Analytics: 'Analitik',
  Database: 'Veritabanı',

  Dashboard: 'Kontrol Paneli',
  Projects: 'Projeler',
  Employees: 'Çalışanlar',
  Departments: 'Departmanlar',
  Products: 'Ürünler',
  Investments: 'Yatırımlar',
  Reports: 'Raporlar',
  'Schema Audit': 'Şema Denetimi',

  /* ---------- Roles and access ---------- */

  Admin: 'Yönetici',
  Analyst: 'Analist',
  Viewer: 'Görüntüleyici',
  'No role assigned': 'Rol atanmamış',

  'SQL-AI Management System': 'SQL-AI Yönetim Sistemi',
  'Signing you in with Keycloak...': 'Keycloak ile oturumunuz açılıyor...',
  'Authentication required': 'Kimlik doğrulama gerekli',
  'Could not reach the Keycloak server. Make sure it is running on the configured URL.':
    'Keycloak sunucusuna ulaşılamadı. Yapılandırılan adreste çalıştığından emin olun.',
  'Your session is not active. Please sign in to continue.':
    'Oturumunuz etkin değil. Devam etmek için giriş yapın.',
  'Sign in': 'Giriş yap',

  'Access denied': 'Erişim reddedildi',
  'The {role} role does not include this page.':
    '{role} rolü bu sayfayı kapsamıyor.',
  'This account has no application role yet. An administrator has to assign one in Keycloak.':
    'Bu hesabın henüz bir uygulama rolü yok. Bir yöneticinin Keycloak üzerinden rol ataması gerekiyor.',
  'Back to dashboard': 'Kontrol paneline dön',

  'Page not found': 'Sayfa bulunamadı',
  'The page you requested does not exist.': 'İstediğiniz sayfa mevcut değil.',
  'Go back to the dashboard': 'Kontrol paneline dönün',

  /* ---------- The shared table ---------- */

  Search: 'Ara',
  'Search records': 'Kayıtlarda ara',
  'No records found.': 'Kayıt bulunamadı.',
  'Nothing to show': 'Gösterilecek bir şey yok',
  'Could not load the data': 'Veriler yüklenemedi',
  'Loading records': 'Kayıtlar yükleniyor',
  Loading: 'Yükleniyor',
  'All {label}': 'Tüm {label}',
  'No matching {noun}': 'Eşleşen {noun} yok',
  'Nothing here matches the current search and filters.':
    'Buradaki hiçbir kayıt mevcut arama ve filtrelerle eşleşmiyor.',
  'Clear search and filters': 'Aramayı ve filtreleri temizle',
  'Previous page': 'Önceki sayfa',
  'Next page': 'Sonraki sayfa',
  '{shown} of {total} {noun}': '{total} {noun} içinden {shown} tanesi',
  '{count} {noun}': '{count} {noun}',
  '{from}-{to} of {total}': '{total} kayıttan {from}-{to}',

  // The nouns a list counts itself in. Turkish takes no plural suffix after a
  // number, so one form covers both "1 proje" and "24 proje".
  records: 'kayıt',
  projects: 'proje',
  employees: 'çalışan',
  departments: 'departman',
  products: 'ürün',
  investments: 'yatırım',
  findings: 'bulgu',

  /* ---------- Column headers and shared field names ---------- */

  Project: 'Proje',
  Program: 'Program',
  Status: 'Durum',
  Budget: 'Bütçe',
  Start: 'Başlangıç',
  End: 'Bitiş',
  ID: 'ID',
  Details: 'Ayrıntılar',
  Employee: 'Çalışan',
  'Job Title': 'Unvan',
  'Job title': 'Unvan',
  Department: 'Departman',
  'Hire Date': 'İşe Giriş Tarihi',
  Product: 'Ürün',
  Category: 'Kategori',
  'Unit Cost': 'Birim Maliyet',
  'Unit cost': 'Birim maliyet',
  Type: 'Tür',
  Amount: 'Tutar',
  Date: 'Tarih',
  Year: 'Yıl',
  Name: 'Ad',
  Total: 'Toplam',
  Remaining: 'Kalan',
  Committed: 'Taahhüt edilen',
  Utilization: 'Kullanım',
  Qty: 'Adet',
  Roles: 'Roller',
  Units: 'Adet',
  Elapsed: 'Geçen süre',
  Hires: 'İşe alım',
  People: 'Kişi',
  Headcount: 'Personel sayısı',
  Payroll: 'Bordro',
  'Average salary': 'Ortalama maaş',
  Programs: 'Programlar',
  Unassigned: 'Atanmamış',
  'Not set': 'Belirtilmemiş',
  'Share of the total': 'Toplam içindeki pay',
  Unknown: 'Bilinmiyor',

  /* ---------- Projects ---------- */

  'Every programme on the books, with its budget, its schedule and where it currently stands. Open one to see its team, products and investments.':
    'Kayıtlı her program; bütçesi, takvimi ve bulunduğu aşama ile birlikte. Ekibini, ürünlerini ve yatırımlarını görmek için birini açın.',
  'Search project name': 'Proje adında ara',
  'Search projects by name': 'Projeleri ada göre ara',
  'All statuses': 'Tüm durumlar',
  'No projects yet': 'Henüz proje yok',
  'The projects table has no rows.': 'projects tablosunda satır yok.',

  /* ---------- Employees ---------- */

  'The company directory: who works here, what they do and which department they belong to.':
    'Şirket rehberi: burada kimler çalışıyor, ne iş yapıyor ve hangi departmana bağlı.',
  'Search name, department or title': 'Ad, departman veya unvan ara',
  'Search employees by name, department or job title':
    'Çalışanları ada, departmana veya unvana göre ara',
  'All departments': 'Tüm departmanlar',
  'No employees yet': 'Henüz çalışan yok',
  'The employees table has no rows.': 'employees tablosunda satır yok.',

  /* ---------- Departments ---------- */

  'Organizational units, what each one is responsible for and how many people it holds.':
    'Organizasyon birimleri, her birinin sorumluluğu ve kaç kişi barındırdığı.',
  'Search departments': 'Departmanlarda ara',
  'Search departments by name or description':
    'Departmanları ada veya açıklamaya göre ara',
  'Employees assigned': 'Atanan çalışan',
  'No departments yet': 'Henüz departman yok',
  'The departments table has no rows.': 'departments tablosunda satır yok.',

  /* ---------- Products ---------- */

  'The product and subsystem catalog, by category and unit cost.':
    'Ürün ve alt sistem kataloğu; kategoriye ve birim maliyete göre.',
  'Search name or description': 'Ad veya açıklama ara',
  'Search products by name or description':
    'Ürünleri ada veya açıklamaya göre ara',
  'All categories': 'Tüm kategoriler',
  'No products yet': 'Henüz ürün yok',
  'The products table has no rows.': 'products tablosunda satır yok.',

  /* ---------- Investments ---------- */

  'Every investment recorded against a project, with its type, amount and date.':
    'Bir projeye kaydedilmiş her yatırım; türü, tutarı ve tarihi ile birlikte.',
  'Search project or type': 'Proje veya tür ara',
  'Search investments by project or investment type':
    'Yatırımları projeye veya yatırım türüne göre ara',
  Records: 'Kayıt',
  'Total amount': 'Toplam tutar',
  'All investment types': 'Tüm yatırım türleri',
  'No investments yet': 'Henüz yatırım yok',
  'The investments table has no rows.': 'investments tablosunda satır yok.',

  /* ---------- Dashboard ---------- */

  'The company at a glance, read live from the database: what is committed, what has been spent and what needs attention.':
    'Şirketin genel görünümü, doğrudan veritabanından okunur: neye taahhüt verildi, ne harcandı ve neye dikkat edilmeli.',
  'Ask your data': 'Verilerinize sorun',
  'Could not load the summary: {message}': 'Özet yüklenemedi: {message}',
  'Total Project Budget': 'Toplam Proje Bütçesi',
  'Committed across {count} projects':
    '{count} projeye taahhüt edildi',
  'Total Investments': 'Toplam Yatırım',
  'Recorded against projects to date':
    'Bugüne kadar projelere kaydedilen',
  'Active Projects': 'Aktif Projeler',
  'Currently in execution, of {count}': '{count} proje içinden yürütülmekte olan',
  'Budget Utilization': 'Bütçe Kullanımı',
  'Needs a budget and recorded investments':
    'Bütçe ve kayıtlı yatırım gerektirir',
  'Investments as a share of budget': 'Bütçeye oranla yatırımlar',
  'On the payroll': 'Bordroda',
  'Organizational units': 'Organizasyon birimleri',
  'Products and subsystems in the catalog':
    'Katalogdaki ürün ve alt sistemler',
  'Portfolio by status': 'Duruma göre portföy',
  'Where the {count} recorded projects stand today.':
    'Kayıtlı {count} projenin bugünkü durumu.',
  'No projects have been recorded yet.': 'Henüz hiçbir proje kaydedilmedi.',
  'Needs attention': 'Dikkat gerektirenler',
  'Active projects past their end date or due within {days} days.':
    'Bitiş tarihini geçmiş veya {days} gün içinde bitecek aktif projeler.',
  'Could not load the projects: {message}': 'Projeler yüklenemedi: {message}',
  'Nothing is overdue': 'Geciken bir şey yok',
  'No active project has passed its end date or reaches it within the next {days} days.':
    'Hiçbir aktif proje bitiş tarihini geçmedi ve önümüzdeki {days} gün içinde de geçmeyecek.',
  '{overdue} overdue, {soon} due soon':
    '{overdue} gecikmiş, {soon} yakında bitiyor',
  'Overdue by {days} days': '{days} gün gecikmiş',
  'Ends today': 'Bugün bitiyor',
  'Ends in {days} days': '{days} gün sonra bitiyor',
  '{count} more not shown.': '{count} kayıt daha gösterilmiyor.',
  'See all projects': 'Tüm projeleri gör',
  'Latest projects': 'En son projeler',
  'The five most recently started programmes.':
    'En son başlatılan beş program.',
  'View all projects': 'Tüm projeleri gör',

  /* ---------- Assistant ---------- */

  Assistant: 'Asistan',
  'Ask about the data in English. Answers appear newest first.':
    'Veriler hakkında İngilizce soru sorun. Cevaplar en yenisi üstte görünür.',
  'One question at a time - no memory of the last one':
    'Her seferinde tek soru - bir önceki hatırlanmaz',
  'Which employees work on the Tactical Radar System project?':
    'Which employees work on the Tactical Radar System project?',
  'Asking...': 'Soruluyor...',
  Ask: 'Sor',
  'Try one of these': 'Bunlardan birini deneyin',
  'Writing the query and running it...':
    'Sorgu yazılıyor ve çalıştırılıyor...',
  'The rows are below. The model was not able to write a summary of them this time.':
    'Satırlar aşağıda. Model bu sefer bunların bir özetini yazamadı.',
  'Hide SQL': "SQL'i gizle",
  'Show SQL': "SQL'i göster",

  /* ---------- Result tables and row counts ---------- */

  'The query ran and returned no rows. That is an answer too - nothing in the data matches the question.':
    'Sorgu çalıştı ve hiç satır döndürmedi. Bu da bir cevaptır - verilerde soruyla eşleşen bir şey yok.',
  '{count} row': '{count} satır',
  '{count} rows': '{count} satır',
  '{count} mo': '{count} ay',
  '{count} mo overdue': '{count} ay gecikmeli',
  'first {count} of {total} rows': '{total} satırın ilk {count} tanesi',
  '{rows} - cut off at the row limit, so the answer may be incomplete':
    '{rows} - satır sınırında kesildi, bu yüzden cevap eksik olabilir',
  'Nothing to chart for this selection.':
    'Bu seçim için grafiğe dökülecek bir şey yok.',

  /* ---------- Reports shell ---------- */

  'Program finance, workforce and portfolio analytics, aggregated in the database.':
    'Program finansmanı, insan kaynağı ve portföy analizleri, veritabanında toplanır.',
  'Print report': 'Raporu yazdır',
  'Report sections': 'Rapor bölümleri',
  Financial: 'Finansal',
  Workforce: 'İnsan Kaynağı',
  Portfolio: 'Portföy',
  Dynamic: 'Dinamik',
  'Could not load the filter options: {message}':
    'Filtre seçenekleri yüklenemedi: {message}',
  'Investment years': 'Yatırım yılları',
  'First investment year': 'İlk yatırım yılı',
  'Last investment year': 'Son yatırım yılı',
  From: 'Başlangıç',
  To: 'Bitiş',
  to: '-',
  'Project status': 'Proje durumu',
  'Filtered by': 'Filtreler',
  '- remove this filter': '- bu filtreyi kaldır',
  'Clear filters': 'Filtreleri temizle',
  'Years: {from} to {to}': 'Yıllar: {from} - {to}',
  'Status: {status}': 'Durum: {status}',
  'Department: {department}': 'Departman: {department}',
  earliest: 'en erken',
  latest: 'en geç',
  'This tab writes its own query from the question you ask, so the filters above the fixed reports do not apply here.':
    'Bu sekme sorduğunuz sorudan kendi sorgusunu yazar, bu yüzden sabit raporların üstündeki filtreler burada geçerli değildir.',

  /* ---------- Report cards ---------- */

  Chart: 'Grafik',
  Table: 'Tablo',
  '{title} view': '{title} görünümü',
  'Download the rows behind "{title}" as a CSV file':
    '"{title}" kartının arkasındaki satırları CSV dosyası olarak indir',
  'Download CSV': "CSV'yi indir",
  'No rows match the filters above. Widen them, or clear them, to see this report.':
    'Yukarıdaki filtrelerle eşleşen satır yok. Bu raporu görmek için filtreleri genişletin veya temizleyin.',
  'Updating for the selected filters':
    'Seçilen filtrelere göre güncelleniyor',

  /* ---------- Financial report ---------- */

  'Could not load the financial report': 'Finansal rapor yüklenemedi',
  'Building the financial report': 'Finansal rapor hazırlanıyor',
  'Total Budget': 'Toplam Bütçe',
  '{count} programs in scope': 'Kapsamdaki program sayısı: {count}',
  '{count} investment records': '{count} yatırım kaydı',
  'Committed against total budget': 'Toplam bütçeye karşı taahhüt edilen',
  Uncommitted: 'Taahhüt edilmemiş',
  'Budget not yet drawn': 'Henüz kullanılmamış bütçe',
  'Over Budget': 'Bütçe Aşımı',
  'Programs past 100% utilization': "%100 kullanımı aşan programlar",
  'Committed investment by year': 'Yıla göre taahhüt edilen yatırım',
  'Money committed against the programs in scope, by the year it was recorded.':
    'Kapsamdaki programlara taahhüt edilen para, kaydedildiği yıla göre.',
  '{count} records': '{count} kayıt',
  'Committed investment by type': 'Türe göre taahhüt edilen yatırım',
  'What the money was spent on, largest first.':
    'Paranın nereye harcandığı, en büyükten başlayarak.',
  'Investment type': 'Yatırım türü',
  'Budget against committed spend': 'Bütçeye karşı taahhüt edilen harcama',
  'One row per program. The meter fills to 100% of budget; anything past it is over-committed.':
    'Her program için bir satır. Gösterge bütçenin %100üne kadar dolar; bunu aşan her şey fazla taahhüttür.',
  'Over budget': 'Bütçe aşıldı',
  'Near limit': 'Sınıra yakın',

  /* ---------- Workforce report ---------- */

  'Could not load the workforce report': 'İnsan kaynağı raporu yüklenemedi',
  'Building the workforce report': 'İnsan kaynağı raporu hazırlanıyor',
  '{count} staffed departments': 'Personeli olan {count} departman',
  'Annual Payroll': 'Yıllık Bordro',
  'Sum of recorded salaries': 'Kayıtlı maaşların toplamı',
  'Average Salary': 'Ortalama Maaş',
  'Average Tenure': 'Ortalama Kıdem',
  '{count} yrs': '{count} yıl',
  'Since hire date': 'İşe giriş tarihinden bu yana',
  'Not On A Program': 'Programda Olmayan',
  'No project assignment': 'Proje ataması yok',
  'Headcount by department': 'Departmana göre personel sayısı',
  'Where the people are.': 'İnsanların bulunduğu yer.',
  '{amount} average': 'Ortalama {amount}',
  'Hires by year': 'Yıla göre işe alımlar',
  'When the current workforce joined.':
    'Mevcut çalışanların işe katıldığı yıl.',
  'Payroll by department': 'Departmana göre bordro',
  'Total recorded salary per department.':
    'Departman başına kayıtlı toplam maaş.',
  '{count} people': '{count} kişi',
  'Program allocation': 'Program dağılımı',
  'How many programs each person is committed to, most loaded first.':
    'Her kişinin kaç programa ayrıldığı, en yüklüden başlayarak.',
  'Job titles': 'Unvanlar',
  'Headcount and average salary per title.':
    'Unvan başına personel sayısı ve ortalama maaş.',

  /* ---------- Portfolio report ---------- */

  'Could not load the portfolio report': 'Portföy raporu yüklenemedi',
  'Building the portfolio report': 'Portföy raporu hazırlanıyor',
  '{count} months average duration': 'Ortalama süre {count} ay',
  'Hardware Cost': 'Donanım Maliyeti',
  'Hardware cost': 'Donanım maliyeti',
  '{count} units across the portfolio': 'Portföy genelinde {count} adet',
  'Catalog Items': 'Katalog Kalemleri',
  'Catalog items': 'Katalog kalemleri',
  'Products and subsystems': 'Ürünler ve alt sistemler',
  'Ending Within A Year': 'Bir Yıl İçinde Bitecek',
  'Active programs closing in 12 months':
    '12 ay içinde kapanacak aktif programlar',
  'Past End Date': 'Bitiş Tarihi Geçmiş',
  'Still Active or On Hold': 'Hâlâ Aktif veya Beklemede',
  'Schedule position': 'Takvim durumu',
  'Where each program sits between its start and end date, soonest deadline first.':
    'Her programın başlangıç ve bitiş tarihi arasındaki konumu, en yakın teslim tarihinden başlayarak.',
  'Time elapsed': 'Geçen süre',
  'Past end date': 'Bitiş tarihi geçti',
  'Duration (months)': 'Süre (ay)',
  'Units on programs': 'Programlardaki adet',
  'Hardware cost by category': 'Kategoriye göre donanım maliyeti',
  'Unit cost multiplied by the quantity each program consumes.':
    'Birim maliyetin her programın tükettiği miktarla çarpımı.',
  '{count} units': '{count} adet',
  'Hardware cost by program': 'Programa göre donanım maliyeti',
  'Material cost only - a program budget also covers labour, test and certification.':
    'Yalnızca malzeme maliyeti - bir program bütçesi ayrıca işçilik, test ve sertifikasyonu da kapsar.',
  '{percent} of budget': 'Bütçenin {percent} kadarı',
  'Distinct products': 'Farklı ürün',
  'Share of budget': 'Bütçe payı',
  'Total cost': 'Toplam maliyet',
  'Product consumption': 'Ürün tüketimi',
  'Which catalog items the portfolio actually draws on.':
    'Portföyün gerçekte kullandığı katalog kalemleri.',
  '{units} units on {programs} programs':
    '{programs} programda {units} adet',

  /* ---------- Dynamic report (Ask) ---------- */

  'One question at a time, in English. The query is written for you, run against the database read-only, and shown with the SQL behind it.':
    'Her seferinde tek soru, İngilizce olarak. Sorgu sizin için yazılır, veritabanında salt okunur çalıştırılır ve arkasındaki SQL ile birlikte gösterilir.',
  'Ask a question about the data': 'Veriler hakkında bir soru sorun',
  'Total investment per year': 'Total investment per year',
  'Name a chart in the question - "as a pie chart", "over time" - and the answer is drawn that way when the result supports it.':
    'Soruda bir grafik türü belirtin - "as a pie chart", "over time" - sonuç uygun olduğunda cevap o şekilde çizilir.',
  'Result preview': 'Sonuç önizlemesi',
  'Writing the query and running it': 'Sorgu yazılıyor ve çalıştırılıyor',
  'Not part of the report yet - keep it, or ask something else.':
    'Henüz raporun parçası değil - saklayın ya da başka bir şey sorun.',
  'Not added': 'Eklenmedi',
  'Add to report': 'Rapora ekle',
  'Report builder': 'Rapor oluşturucu',
  Report: 'Rapor',
  'Untitled report': 'Adsız rapor',
  'Untitled card': 'Adsız kart',
  'Report title': 'Rapor başlığı',
  'Report description': 'Rapor açıklaması',
  'What this report is for': 'Bu raporun amacı',
  'Unsaved changes': 'Kaydedilmemiş değişiklikler',
  'Saved in this browser': 'Bu tarayıcıya kaydedildi',
  'Open a saved report': 'Kayıtlı bir raporu aç',
  'Select...': 'Seçin...',
  Refresh: 'Yenile',
  'Running...': 'Çalışıyor...',
  Save: 'Kaydet',
  'Save report': 'Raporu kaydet',
  'Save as new': 'Yeni olarak kaydet',
  Delete: 'Sil',
  Clear: 'Temizle',
  Remove: 'Kaldır',
  'This browser is not storing site data, so a report can be built and printed but not saved.':
    'Bu tarayıcı site verisi saklamıyor, bu yüzden bir rapor oluşturulup yazdırılabilir ama kaydedilemez.',
  'Saved reports live in this browser only. Each card keeps its query, not its rows, so opening one shows the figures as they are today.':
    'Kayıtlı raporlar yalnızca bu tarayıcıda durur. Her kart satırlarını değil sorgusunu saklar, bu yüzden bir raporu açtığınızda bugünkü değerleri görürsünüz.',
  'No cards yet': 'Henüz kart yok',
  'Ask a question above, then keep the answers worth keeping - they become a report you can name, save and print.':
    'Yukarıdan bir soru sorun, sonra saklamaya değer cevapları saklayın - bunlar adlandırabileceğiniz, kaydedebileceğiniz ve yazdırabileceğiniz bir rapora dönüşür.',
  'This browser would not store the report. Check its site data settings.':
    'Bu tarayıcı raporu saklamadı. Site verisi ayarlarını kontrol edin.',
  'Saved "{title}" in this browser.':
    '"{title}" bu tarayıcıya kaydedildi.',
  'The saved copy was deleted. What is on screen is still here.':
    'Kayıtlı kopya silindi. Ekrandakiler hâlâ burada.',
  'Replace the result on screen?': 'Ekrandaki sonuç değiştirilsin mi?',
  'This result has not been added to the report yet. Asking another question replaces it, and getting it back means asking again.':
    'Bu sonuç henüz rapora eklenmedi. Başka bir soru sormak onu değiştirir ve geri getirmek için yeniden sormak gerekir.',
  'Replace it': 'Değiştir',
  'Keep it': 'Sakla',
  'Open another report?': 'Başka bir rapor açılsın mı?',
  'The report on screen has changes that have not been saved. Opening another one discards them.':
    'Ekrandaki raporda kaydedilmemiş değişiklikler var. Başka bir rapor açmak bunları siler.',
  'Discard and open': 'Sil ve aç',
  'Stay here': 'Burada kal',
  'Delete this saved report?': 'Bu kayıtlı rapor silinsin mi?',
  '"{title}" will be removed from this browser. The cards stay on screen, but the saved copy cannot be recovered.':
    '"{title}" bu tarayıcıdan kaldırılacak. Kartlar ekranda kalır ama kayıtlı kopya geri getirilemez.',
  'Delete it': 'Sil',
  'Clear this report?': 'Bu rapor temizlensin mi?',
  'Every card on screen is removed and the title is cleared. These changes have not been saved, so they cannot be brought back.':
    'Ekrandaki her kart kaldırılır ve başlık temizlenir. Bu değişiklikler kaydedilmedi, bu yüzden geri getirilemez.',
  'Every card on screen is removed and the title is cleared. The saved copy stays in this browser and can be opened again.':
    'Ekrandaki her kart kaldırılır ve başlık temizlenir. Kayıtlı kopya bu tarayıcıda kalır ve yeniden açılabilir.',
  'Clear it': 'Temizle',
  'Remove this card?': 'Bu kart kaldırılsın mı?',
  '"{title}" is taken out of the report. The question and its query go with it.':
    '"{title}" rapordan çıkarılır. Soru ve sorgusu da onunla birlikte gider.',
  'Remove it': 'Kaldır',
  Confirm: 'Onayla',
  Cancel: 'Vazgeç',
  Close: 'Kapat',
  'Try again': 'Yeniden dene',

  /* ---------- What the API layer says when a request does not arrive ------ */

  'Request failed with status {status}': 'İstek {status} durumuyla başarısız oldu',
  'Your session has expired. Redirecting to the login page.':
    'Oturumunuzun süresi doldu. Giriş sayfasına yönlendiriliyorsunuz.',
  'Could not reach the server. Check that the backend is running, then try again.':
    'Sunucuya ulaşılamadı. Arka ucun çalıştığını kontrol edip yeniden deneyin.',

  /* ---------- Query result card ---------- */

  Result: 'Sonuç',
  'Card title': 'Kart başlığı',
  'Cut off at the row limit': 'Satır sınırında kesildi',
  'Running again...': 'Yeniden çalıştırılıyor...',
  'Chart type': 'Grafik türü',
  Measure: 'Ölçüt',
  Figures: 'Değerler',
  Columns: 'Sütunlar',
  Line: 'Çizgi',
  Bars: 'Çubuklar',
  Donut: 'Halka',
  Copied: 'Kopyalandı',
  'Copy the SQL': "SQL'i kopyala",
  'SQL copied to the clipboard': 'SQL panoya kopyalandı',
  'Move "{title}" up': '"{title}" kartını yukarı taşı',
  'Move "{title}" down': '"{title}" kartını aşağı taşı',

  /* ---------- Project detail ---------- */

  'Close project details': 'Proje ayrıntılarını kapat',
  'Loading project': 'Proje yükleniyor',
  'Project not found': 'Proje bulunamadı',
  'Project could not be loaded': 'Proje yüklenemedi',
  'Loading project details': 'Proje ayrıntıları yükleniyor',
  'No project has the ID {id}': '{id} kimliğine sahip bir proje yok',
  'It may have been removed, or the link may be mistyped. The project list is still behind this panel.':
    'Kaldırılmış olabilir veya bağlantı yanlış yazılmış olabilir. Proje listesi hâlâ bu panelin arkasında.',
  'Back to projects': 'Projelere dön',
  'The project details did not load': 'Proje ayrıntıları yüklenemedi',
  'Project sections': 'Proje bölümleri',
  Team: 'Ekip',
  'Budget position': 'Bütçe durumu',
  'Total invested': 'Toplam yatırım',
  'Budget not available': 'Bütçe mevcut değil',
  'Budget is zero': 'Bütçe sıfır',
  'Over budget by {amount}': '{amount} kadar bütçe aşımı',
  'Within budget, close to its limit': 'Bütçe içinde, sınırına yakın',
  'Within budget': 'Bütçe içinde',
  About: 'Hakkında',
  'Schedule and budget': 'Takvim ve bütçe',
  Duration: 'Süre',
  'Dates not recorded': 'Tarihler kaydedilmemiş',
  Timeline: 'Zaman çizelgesi',
  'Starts in {duration}': '{duration} sonra başlıyor',
  '{duration} until the end date': 'Bitiş tarihine {duration} var',
  'Ended {duration} ago': '{duration} önce bitti',
  '{duration} past the end date': 'Bitiş tarihini {duration} geçti',
  'Linked records': 'Bağlı kayıtlar',
  '{people} from {departments}': '{departments} içinden {people}',
  '{products}, {units}': '{products}, {units}',
  '{summary} in {categories}': '{summary}, {categories} içinde',
  '{records}, latest {date}': '{records}, en son {date}',
  'No team members assigned': 'Atanmış ekip üyesi yok',
  'People appear here once they are assigned to this project.':
    'Bu projeye atanan kişiler burada görünür.',
  'Team members': 'Ekip üyeleri',
  'Role on project': 'Projedeki rolü',
  Title: 'Unvan',
  'No products assigned': 'Atanmış ürün yok',
  'Products and subsystems appear here once they are allocated to this project.':
    'Bu projeye tahsis edilen ürün ve alt sistemler burada görünür.',
  'Products used': 'Kullanılan ürünler',
  'No investments recorded': 'Kayıtlı yatırım yok',
  'Investments appear here once they are recorded against this project.':
    'Bu projeye kaydedilen yatırımlar burada görünür.',
  'Investments, newest first': 'Yatırımlar, en yenisi önce',

  // Units counted after a number. Turkish adds no plural suffix there.
  day: 'gün',
  days: 'gün',
  month: 'ay',
  months: 'ay',
  record: 'kayıt',
  person: 'kişi',
  people: 'kişi',
  product: 'ürün',
  unit: 'adet',
  units: 'adet',
  category: 'kategori',
  categories: 'kategori',
  department: 'departman',

  /* ---------- Schema audit ---------- */

  'Structural review of the "{schema}" schema against {count} rules.':
    '"{schema}" şemasının {count} kurala göre yapısal incelemesi.',
  'Analysing the schema': 'Şema inceleniyor',
  'Could not run the audit': 'Denetim çalıştırılamadı',
  'Read-only.': 'Salt okunur.',
  'The audit reads the catalog and writes out the statements it would suggest - nothing is applied to the database, here or anywhere else. Review every statement before you run it.':
    'Denetim katalogu okur ve önereceği ifadeleri yazar - ne burada ne başka bir yerde veritabanına hiçbir şey uygulanmaz. Çalıştırmadan önce her ifadeyi gözden geçirin.',
  Findings: 'Bulgular',
  '{tables} tables, {keys} foreign keys, {indexes} indexes':
    '{tables} tablo, {keys} yabancı anahtar, {indexes} indeks',
  Errors: 'Hatalar',
  'Break integrity or block work': 'Bütünlüğü bozar veya işi engeller',
  Warnings: 'Uyarılar',
  'Worth fixing deliberately': 'Bilinçli olarak düzeltmeye değer',
  Info: 'Bilgi',
  'Consistency and documentation': 'Tutarlılık ve dokümantasyon',
  Severity: 'Önem derecesi',
  'Findings by table': 'Tabloya göre bulgular',
  'A finding can concern more than one table - a loop, or a column declared two ways - so these add up to more than the total.':
    'Bir bulgu birden fazla tabloyu ilgilendirebilir - bir döngü ya da iki farklı biçimde tanımlanmış bir sütun - bu yüzden bu sayıların toplamı bulgu sayısından fazla çıkar.',
  'No finding names a table.': 'Hiçbir bulgu bir tablo adı taşımıyor.',
  'No finding in this selection names a table.':
    'Bu seçimde tablo adı taşıyan bir bulgu yok.',
  'Search findings': 'Bulgularda ara',
  'Rule, table, column, severity or message':
    'Kural, tablo, sütun, önem derecesi veya mesaj',
  '{shown} of {total} findings': '{total} bulgudan {shown} tanesi',
  '{count} findings': '{count} bulgu',
  'Show rules': 'Kuralları göster',
  'Hide rules': 'Kuralları gizle',
  'Rule catalog': 'Kural kataloğu',
  'Every check the audit runs, and what each one looks for.':
    'Denetimin çalıştırdığı her kontrol ve her birinin neye baktığı.',
  'Loading rules': 'Kurallar yükleniyor',
  'Could not load the rules': 'Kurallar yüklenemedi',
  Rule: 'Kural',
  'Checks for': 'Neye bakar',
  'No findings match': 'Eşleşen bulgu yok',
  'Nothing to report': 'Bildirilecek bir şey yok',
  'Nothing matches what is selected.': 'Seçili olanla eşleşen bir şey yok.',
  'Clear the filter': 'Filtreyi temizle',
  'The audit ran and found nothing against these rules.':
    'Denetim çalıştı ve bu kurallara aykırı bir şey bulmadı.',
  'Generated at {timestamp}': '{timestamp} tarihinde oluşturuldu',
  // The heading a finding card carries. Written for someone reading the page
  // rather than someone reading the rule set; the technical name stays in the
  // rule catalog and inside the opened card.
  'No primary key': 'Birincil anahtar yok',
  'Delete rule not set': 'Silme kuralı belirsiz',
  'Update rule not set': 'Güncelleme kuralı belirsiz',
  'Table stands alone': 'Bağlantısız tablo',
  'Tables reference in a loop': 'Döngüsel tablo bağlantısı',
  'Repeated index': 'Tekrarlayan indeks',
  'Index already covered': 'İndeks zaten kapsanıyor',
  'Linked columns differ in type': 'Bağlantı tipi uyuşmuyor',
  'Link has no index': 'İndekssiz bağlantı',
  'Link is not enforced': 'Korumasız bağlantı',
  'Same name, different types': 'Aynı ad, farklı tip',

  Heuristic: 'Sezgisel',
  '{count} fix': '{count} düzeltme',
  '{count} fixes': '{count} düzeltme',
  Explain: 'Açıkla',
  'What this means': 'Bu ne anlama geliyor',
  'Written by a model': 'Bir model tarafından yazıldı',
  'How to fix it': 'Nasıl düzeltilir',
  'From the audit': 'Denetimden',
  'The audit has no statement to suggest for this one.':
    'Denetimin bunun için önerebileceği bir ifade yok.',
  'Nothing here runs by itself. Copy a statement, read it, and run it where you would run any other migration.':
    'Buradaki hiçbir şey kendiliğinden çalışmaz. Bir ifadeyi kopyalayın, okuyun ve başka bir göç betiğini nerede çalıştırıyorsanız orada çalıştırın.',
  'Asking the model to explain this': 'Modelden bunu açıklaması isteniyor',
  'Could not explain this one: {message}': 'Bu bulgu açıklanamadı: {message}',
  'Written by {generator}. The statements beside it come from the audit, not from the model.':
    '{generator} tarafından yazıldı. Yanındaki ifadeler modelden değil, denetimden gelir.',
  Recommended: 'Önerilen',
  '{risk} risk': '{risk} risk',
  'Your call': 'Karar sizin',
  'Copy this statement': 'Bu ifadeyi kopyala',
  'Copy the statement for {label}': '{label} için ifadeyi kopyala',
  Copy: 'Kopyala',
  'Copied to the clipboard': 'Panoya kopyalandı',

  /* ---------- Closed sets stored in the database ---------- */

  // Project status, as it appears on badges, filters and reports.
  Active: 'Aktif',
  Planning: 'Planlama',
  Completed: 'Tamamlandı',
  'On Hold': 'Beklemede',

  // Investment types.
  'R&D Fund': 'Ar-Ge Fonu',
  'Equipment Purchase': 'Ekipman Alımı',
  'Personnel Cost': 'Personel Gideri',
  'Test Infrastructure': 'Test Altyapısı',
  Tooling: 'Takım ve Kalıp',
  Certification: 'Sertifikasyon',
  Subcontracting: 'Alt Yüklenici',
  Training: 'Eğitim',
  'Software License': 'Yazılım Lisansı',
  'Facility Upgrade': 'Tesis Yenileme',
  'Feasibility Study': 'Fizibilite Çalışması',

  // Product categories.
  Sensor: 'Sensör',
  Avionics: 'Aviyonik',
  Communication: 'Haberleşme',
  'Ground Systems': 'Yer Sistemleri',
  Electronics: 'Elektronik',
  Platform: 'Platform',
  Software: 'Yazılım',
  Propulsion: 'İtki',
  Structure: 'Yapı',
  'Test Equipment': 'Test Ekipmanı',
  Power: 'Güç',

  // Audit severity and risk, which arrive lower case and are printed as they
  // come.
  error: 'hata',
  warning: 'uyarı',
  info: 'bilgi',
  low: 'düşük',
  medium: 'orta',
  high: 'yüksek',
}

export default tr
