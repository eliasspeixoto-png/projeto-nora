importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-messaging-compat.js');

// Configurações do Firebase vindas das variáveis de ambiente (substituídas durante o build se necessário, 
// ou lidas aqui se tivermos esses valores hardcoded ou passados via parâmetro).
// Como é um arquivo estático na pasta public, precisamos dos valores aqui.

firebase.initializeApp({
  apiKey: "AIzaSyAbsSLQR9GZ11-cluOnje7Drs0rQt_fwus",
  authDomain: "studio-2629657699-721b1.firebaseapp.com",
  projectId: "studio-2629657699-721b1",
  storageBucket: "studio-2629657699-721b1.firebasestorage.app",
  messagingSenderId: "853808240420",
  appId: "1:853808240420:web:d9062a4ae8ccce00b785b1"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Se já houver o campo notification, o navegador exibirá automaticamente.
  // Evitamos chamar showNotification aqui para não duplicar.
  if (payload.notification) {
    console.log('[firebase-messaging-sw.js] Automatic notification detected, skipping manual show.');
    return;
  }

  const data = payload.data || {};
  const notificationTitle = data.nora_title || data.title || 'NORA Pro';
  const notificationOptions = {
    body: data.nora_body || data.message || '',
    icon: 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20Favicon.png?alt=media&token=f56d3bc9-57a1-48e4-a84b-f263e729c0a9',
    data: {
        url: data.click_action || '/ordem-de-servico'
    },
    badge: 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20Favicon.png?alt=media&token=f56d3bc9-57a1-48e4-a84b-f263e729c0a9',
    tag: data.type || 'notificacao-geral',
    renotify: true,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Listener para o clique na notificação - Abre ou foca no app
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Fecha a notificação ao clicar
  
  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Tentar encontrar uma janela já aberta do NORA
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(targetUrl).then(c => c.focus());
        }
      }
      // Se não tiver janela aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
