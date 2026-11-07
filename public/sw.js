self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  // Laisse le navigateur gérer les requêtes normalement
});
