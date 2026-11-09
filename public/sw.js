// Service Worker de base pour la PWA SCEAU
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Écouteur pour les notifications Push (simulé pour le lancement)
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'SCEAU', body: 'Nouvelle preuve gravée.' };
  
  const options = {
    body: data.body,
    icon: 'https://ui-avatars.com/api/?name=S&background=E76F51&color=fff&size=192',
    badge: 'https://ui-avatars.com/api/?name=S&background=E76F51&color=fff&size=96',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/feed' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clic sur la notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
