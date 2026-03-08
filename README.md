# Duno - Multiplayer Card Game MVP

Duno is a web-based, multiplayer card game prototype inspired by UNO. It features real-time Socket.io communication, customizable lobbies, and mobile-friendly UI support (via Capacitor).

## Özellikler (Features)
- Çok Oyunculu Lobi ve Oda Sistemi: 4 kişiye kadar oyuncu desteği.
- Renk ve Sayı Eşleştirme: Kartların oynanabilirlik kuralları (Backend Validation).
- Özel Kart Etkileri: 
  - **Reverse (Yön Değiştirici)**: Oyun yönünü (+1'den -1'e) değiştirir. 2 oyunculu modda pas geçme (skip) etkisi yaratır.
  - **Skip (Pas Geçme)**: Sıradaki oyuncuyu atlar.
  - **Draw 2 (+2)**: Sonraki oyuncuya fazladan 2 kart çektirir ve sırasını pas geçirir.
  - **Wild (Renk Değiştirme)**: İstenilen rengi seçmenize imkan tanır.
  - **Wild Draw 4 (+4)**: İstenen rengi seçtirir, sonraki oyuncuya 4 kart çektirir ve onun sırasını pas geçirir.
- FIRT (Uno) Mekaniği: Tek kartınız kaldığında "FIRT" butonuna tıklamazsanız rakipleriniz sizi 2 kart cezaya çaptırabilir.

## Kurulum (Installation)
Projeyi yerel ortamınızda ayağa kaldırmak için:
\`\`\`bash
npm install
\`\`\`

Ortam değişkenlerinizi (Port vs.) yapılandırmak için ana dizinde bir `.env` dosyası oluşturun (örnek `.env` hali hazırda oluşturulmuştur).

## Çalıştırma
Geliştirme süreci için sunucuyu başlatmak:
\`\`\`bash
npm run dev
# veya production için
npm start
\`\`\`
Ardından tarayıcınızdan http://localhost:3000 adresine giderek oyunu oynayabilirsiniz.

## Android Build (Capacitor)
Oyun Capacitor JS ile Android uygulaması haline getirilebilir.
1. `npm install` ve web klasörlerinin (`www`) hazır olduğundan emin olun.
2. `npx cap sync android`
3. `npx cap open android` ile Android Studio'da açıp derleyebilirsiniz.

## Testler
Projeye dahil edilen mantık ve oyun motoru testlerini çalıştırmak için:
\`\`\`bash
npm test
\`\`\`

## Bilinen Eksikler / Notlar
- Oyun lobisinden çıkma özelliği şu anda basitçe "Tarayıcıyı Yenile" veya "Geri Git" senaryosuna bağlıdır.
- Tamamlanan oyunları yeniden başlatmak (Rematch) için lobiye geri dönüş henüz tam eklenmemiştir.
