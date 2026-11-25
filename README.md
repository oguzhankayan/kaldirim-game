# KALDIRIM

**Önce bir taş. Sonra bir sıra. Sonunda bütün sokak.**

Browser-first, birinci şahıs taş döşeme oyunu. Küçük eğitim görevleri yerine ilk dakikadan büyük bir iş vardır. Aynı işin içinde kazandıkça ekipman kiralanır; başka bir işe geçildiğinde işçilik bakiyesi, ekipmanlar ve yükseltmeler sıfırlanır. Ustalık kayıtları korunur. Tarayıcıyı kapatmak ilerlemeyi sıfırlamaz.

## Çalıştırma

Node.js 22.12+ önerilir.

```bash
npm ci
npm run dev
```

```bash
npm run check          # strict TypeScript + unit tests + production build
npm run test:e2e       # gerçek tarayıcı / üretim duman testleri
npm run preview
```

Playwright ilk kurulum: `npx playwright install --with-deps chromium`.

## Oyun

| İş | Döşenecek taş |
|---|---:|
| Sahil Sokağı · köşeli kaldırım | 11.712 |
| Pazar Meydanı · açık meydan | 18.080 |
| Çınar Parkı · bağlantılı bahçe yolları | 26.776 |
| Kıyı Yolu · seyir cepli sahil yolu | 32.256 |
| Eski Mahalle · köşeleri bahçeli avlu | 42.380 |

Bu tablo yeni başlatılan işlerin ikinci sürümüdür. Eski kayıtlar kendi alanını, fiyatlarını ve ilerlemesini korur; yeni işe geçişte güncel plan kullanılır. Yeniliği görmek için mevcut kaydı silmek gerekmez.

Her şantiyede taş döşeyerek **o anda** işçilik kazanılır. El işçiliğinden 6 taşlık kıskaca, 18 taşlık sıra aparatına ve 48 taşlık K-48'e geçilir. Taşıma, hız, mobil ikmal, erişim ve geniş başlık yükseltmeleri bulunur. Tüm malzeme ücretsizdir. Son geçişte para kazanılmaz; eksik alanların tamamlanması gerekir.

Ekipman için para hazır olduğunda nişanı kapatmayan, bir defalık bildirim ve kısa bir ses gelir. Desen panoları tamamlandıkça sade geri bildirim verilir. Yeni işlerin son geçişinde sol tuşu basılı tutup yürürsün; kompaktör uzak nişanı değil hemen önündeki zemini işler. Bitişte geçilebilir önce/sonra gösterimi, sonuçlar ve bitmiş işi serbest gezme vardır.

## Kontroller

| Girdi | İşlem |
|---|---|
| WASD / Shift | Yürü / hızlı yürü |
| Fare | Bakış |
| Sol tuş basılı | Sabit hedefte çalış |
| R veya E | İkmal |
| B | Ekipman ve yükseltmeler |
| 1–4 | Kiralanmış aletler arasında geçiş |
| Q | Çalışma alanını döndür |
| F | En yakın eksik alanı göster |
| Tab | Harita |
| P veya Esc | Duraklat / fareyi serbest bırak (portalda Esc tam ekrandan da çıkar) |
| F3 | Çizim/FPS tanılama |
| P (F3 açıkken) | Yerel performans ve gelişim olay raporunu dışa aktar |

Fareyi rastgele savurmak taş döşemez: aynı geçerli çalışma alanına erişim içinde nişan alıp aletin hareketini bitirmek gerekir. Mouse basılıyken tamamlanan aynı alana tekrar ücret yazılmaz. Kenar/köşe boşlukları oyun sonunu kilitlemez.

## Teknoloji

TypeScript + Three.js + Rapier WASM + Vite. Tüm modeller, yüzey dokuları ve dünya özgün prosedürel Three.js üretimidir. Sesler Web Audio ile sentezlenir. Harici GLB, doku veya müzik indirilmez. AI çalışma zamanı çağrısı ve hesap zorunluluğu yoktur.

Statik `dist/` herhangi bir HTTPS statik sunucuda barındırılabilir. Üretim çıktısı çevrimdışı service worker, yerel kayıt ve kayıt dışa/içe aktarımı içerir. Portal derlemesi için `.env.example` dosyasını inceleyin; canlı ödüllü reklam veya satın alma varmış gibi davranılmaz. Steam wrapper/Steamworks ve mağaza yayını bu depoda tamamlanmış değildir.

## Proje belgeleri

- `GAME_DESIGN.md`: kabul edilen oyun kuralları
- `ART_DIRECTION.md`: görsel hedefler
- `docs/ARCHITECTURE.md`: modül sınırları ve teknik kararlar
- `docs/ECONOMY.md`: bölüm içi ilerleme ve dengeleme
- `docs/EVOLUTION.md`: bildirim, iş sürümleri, ekipman hissi ve bitiş sistemi
- `docs/RELEASE.md`: yayın öncesi kontrol listesi
- `docs/STATUS.md`: uygulananlar, doğrulamalar ve açık sınırlar
- `THIRD_PARTY_NOTICES.md`: bağımlılıklar ve araştırma referansları

## Dürüst kalite notu

Bu sürümün ticari yayına hazır olduğuna yalnızca testlerin geçmesine bakarak karar verilmez. Gerçek donanımda performans, tam kampanya oynanışı, tarayıcılar ve görsel sanat yönetimi için `docs/RELEASE.md` kontrol listesi uygulanmalıdır. Kod testleri oyun hissinin iyi olduğunu veya her cihazda 60 FPS'yi kanıtlamaz.

## Lisans

Bu proje MIT lisansı ile açık kaynaklıdır; ayrıntılar `LICENSE` dosyasındadır. Üçüncü taraf bağımlılıklar kendi lisanslarına tabidir; bkz. `THIRD_PARTY_NOTICES.md`.
