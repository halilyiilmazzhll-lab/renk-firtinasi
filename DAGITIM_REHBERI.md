# Renk Fırtınası Ücretsiz Dağıtım / TWA (WebView) Rehberi

Oyun kodunu Android'de "WebView" (TWA mantığı) ile çalışacak şekilde optimize ettik. **Böylece koda yeni bir özellik eklediğinizde, Android uygulamasını (APK) yeniden derlemenize gerek kalmayacak.** Uygulama her açıldığında doğrudan buluttaki en güncel oyununuzu internetten çekecektir!

## 1. Oyunu İnternete Açmak: Render.com (Ücretsiz Katman)
1. Bilgisayarınızdaki bu proje klasörünü tüm içeriğiyle birlikte (`www` klasörü ve `server.js` dahil) **GitHub** hesabınıza yeni bir repo olarak yükleyin (Örn ad: `renk-firtinasi`).
2. [Render.com](https://render.com)'a gidin ve GitHub ile giriş yapın.
3. Sağ üstten **New** -> **Web Service** seçin.
4. "Build and deploy from a Git repository" diyerek GitHub'daki reponuzu seçin.
5. Ayarlarda şunları belirleyin:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (veya `node server.js`)
   - Paket planı: **Free ($0/month)** 
6. "Create Web Service" butonuna tıklayın. İşlem bittiğinde Render size bir adres verecek (Örn: `https://renk-oyunu.onrender.com`). Bu URL'yi **kopyalayın**.

## 2. İstemci Uygulamasını (Android APK) Derlemek
Render.com size bir adres verdiğinde, Android uygulamasına bu adresi açmasını söylememiz gerekiyor.

1. Proje ana dizinindeki `capacitor.config.json` dosyasını açın.
2. `server.url` kısmına, Render'dan aldığınız tam adresi ("https://" ile birlikte) yapıştırın:
   ```json
   {
     "appId": "com.aile.dunogame",
     "appName": "duno_game",
     "webDir": "www",
     "server": {
       "url": "https://renk-oyunu.onrender.com",
       "cleartext": true
     }
   }
   ```
3. Dosyayı kaydedin.
4. `www/js/app.js` dosyasının **en başına** gidip `PROD_SERVER_URL` sabitini aynı şekilde güncelleyin.
5. Terminalinizde (örneğin VSCode terminalinde) şu komutları sırayla çalıştırıp değişiklikleri yansıtın:
   ```bash
   npx cap sync android
   ```
6. Android Studio'yu açmak için:
   ```bash
   npx cap open android
   ```
7. **Android Studio** açılınca, Gradle eşitlenmesini bekleyin. Ardından üst menüden **Build > Build Bundle(s) / APK(s) > Build APK(s)** seçeneğine gidin.
8. Derleme bitince sağ altta beliren "locate" veya "show in explorer" tuşuna basarak oluşan **app-debug.apk** dosyanızı alın.

Tebrikler! Bu APK, adeta bir "Tarayıcı Çerçevesi" gibi çalışıp sizin Render'daki gerçek oyununuzu açacaktır. Siz Github'a kod pushladıkça, Render oyunu güncelleyecek ve telefonunuzdaki APK dokunulmadan otomatik olarak yeni versiyonu oynatmaya başlayacaktır.
