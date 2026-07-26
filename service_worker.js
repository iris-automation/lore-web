'use strict';

// Service worker de Lore.
//
// Flutter n'en génère plus qu'une coquille qui se désinscrit elle-même : sans
// celui-ci, l'app retélécharge ~7 Mo à chaque lancement et ne s'ouvre PAS sans
// réseau — alors que c'est précisément la promesse du produit : un carnet de
// voyage qui marche au bout du monde, sans données.
//
// Il remplace `flutter_service_worker.js` à la fin du build ; le chargeur de
// Flutter l'enregistre déjà avec `?v=<version du build>`, ce qui nous donne
// gratuitement l'invalidation à chaque déploiement.

const VERSION = new URL(self.location).searchParams.get('v') || 'dev';

/// Coquille de l'app : versionnée, purgée à chaque déploiement.
const CACHE_APP = `lore-app-${VERSION}`;

/// Photos des lieux : 51 Mo au catalogue, mises en cache à l'usage seulement,
/// et conservées d'une version à l'autre — elles ne changent pas.
const CACHE_MEDIA = 'lore-media-v1';

/// Toujours pris au réseau quand il y a du réseau.
///
/// Sans cette exception, une PWA se verrouille sur sa propre version : le vieux
/// `index.html` en cache recharge le vieux chargeur, qui réenregistre le vieux
/// service worker, qui resert le vieux `index.html`… et le déploiement suivant
/// n'arrive jamais. Ces deux fichiers pèsent quelques kilo-octets.
const TOUJOURS_FRAIS = /\/(index\.html|flutter_bootstrap\.js)(\?|$)|\/$/;

/// Les photos vont dans leur propre cache, à longue vie.
const EST_MEDIA = /\/assets\/assets\/images\//;

self.addEventListener('install', (event) => {
  // Prendre la main tout de suite : la version fraîchement déployée ne doit
  // pas attendre la fermeture de tous les onglets pour s'activer.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms
          .filter((n) => n !== CACHE_APP && n !== CACHE_MEDIA)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const memeOrigine = url.origin === self.location.origin;

  // CanvasKit et les polices de repli viennent de gstatic : on les garde aussi,
  // sinon l'app reste dépendante d'un CDN tiers pour démarrer.
  if (!memeOrigine && !/gstatic\.com/.test(url.hostname)) return;

  if (TOUJOURS_FRAIS.test(url.pathname)) {
    event.respondWith(reseauDAbord(req));
    return;
  }

  event.respondWith(
    cacheDAbord(req, EST_MEDIA.test(url.pathname) ? CACHE_MEDIA : CACHE_APP),
  );
});

/// Réseau d'abord, cache en filet de sécurité (hors ligne, avion, tunnel).
async function reseauDAbord(req) {
  try {
    const reponse = await fetch(req);
    if (reponse && reponse.ok) {
      const cache = await caches.open(CACHE_APP);
      cache.put(req, reponse.clone());
    }
    return reponse;
  } catch (_) {
    const cache = await caches.open(CACHE_APP);
    // Une navigation peut arriver sur n'importe quelle URL : on retombe sur
    // la page d'accueil, l'app est une page unique.
    return (
      (await cache.match(req)) ||
      (await cache.match('index.html')) ||
      (await cache.match('./')) ||
      Response.error()
    );
  }
}

/// Cache d'abord : c'est ce qui rend le deuxième lancement instantané.
///
/// Le cache est rempli en tâche de fond quand la ressource manque ; comme le
/// cache de la coquille est purgé à chaque nouvelle version, on ne sert jamais
/// un `main.dart.js` périmé après un déploiement.
async function cacheDAbord(req, nomCache) {
  const cache = await caches.open(nomCache);
  const enCache = await cache.match(req);
  if (enCache) return enCache;

  try {
    const reponse = await fetch(req);
    // `ok` exclut les 404 ; les réponses opaques (CDN sans CORS) ont un
    // status 0 mais restent utilisables et valent la peine d'être gardées.
    if (reponse && (reponse.ok || reponse.type === 'opaque')) {
      cache.put(req, reponse.clone());
    }
    return reponse;
  } catch (e) {
    return enCache || Response.error();
  }
}
