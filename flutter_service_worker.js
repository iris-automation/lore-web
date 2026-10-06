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

/// Empreinte du dernier déploiement, lue dans un `index.html` frais.
///
/// Le premier chargement après un déploiement passe encore par l'ANCIEN
/// service worker : il servait l'ancien moteur depuis son cache, et l'on
/// tournait une visite en retard — un correctif du jour du lancement
/// n'arrivait qu'au passage suivant. Quand l'empreinte lue diffère de la
/// sienne, il se sait périmé et laisse la coquille venir du réseau.
let versionEnLigne = null;

/// Requête qui demande au serveur la version ACTUELLE du fichier.
///
/// GitHub Pages autorise 10 minutes de cache HTTP (`max-age=600`) : un simple
/// `fetch` pouvait rendre l'ancien `index.html` — ou ranger l'ancien
/// `main.dart.wasm` dans le cache de la NOUVELLE version, à côté d'un
/// `main.dart.mjs` neuf, et l'app ne démarrait plus. `no-cache` revalide
/// auprès du serveur (ETag : un 304 de quelques octets si rien n'a changé).
function fraisDuServeur(req) {
  if (req.mode === 'navigate') {
    // Une requête de navigation ne se recopie pas avec des options : on la
    // reconstruit. `redirect: 'manual'` garde une redirection utilisable
    // comme réponse de navigation.
    return fetch(new Request(req.url, {
      cache: 'no-cache',
      credentials: 'same-origin',
      redirect: 'manual',
    }));
  }
  return fetch(req, { cache: 'no-cache' });
}

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

  const media = EST_MEDIA.test(url.pathname);
  if (!media && memeOrigine && versionEnLigne && versionEnLigne !== VERSION) {
    // Service worker périmé : la coquille vient du réseau, sans polluer
    // l'ancien cache. Le nouveau prend la main à la fin du chargement.
    event.respondWith(
      fraisDuServeur(req).catch(async () =>
        (await caches.match(req)) || Response.error()),
    );
    return;
  }

  event.respondWith(cacheDAbord(req, media ? CACHE_MEDIA : CACHE_APP));
});

/// Réseau d'abord, cache en filet de sécurité (hors ligne, avion, tunnel).
async function reseauDAbord(req) {
  try {
    const reponse = await fraisDuServeur(req);
    if (reponse && reponse.ok) {
      const cache = await caches.open(CACHE_APP);
      cache.put(req, reponse.clone());
      const type = reponse.headers.get('content-type') || '';
      if (type.includes('text/html')) {
        const trouve = (await reponse.clone().text())
          .match(/flutter_service_worker\.js\?v=([0-9A-Za-z]+)/);
        if (trouve) versionEnLigne = trouve[1];
      }
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
    // Les photos ne changent jamais ; la coquille, elle, doit correspondre au
    // déploiement en cours (voir fraisDuServeur).
    const memeOrigine = new URL(req.url).origin === self.location.origin;
    const reponse = memeOrigine && nomCache === CACHE_APP
        ? await fraisDuServeur(req)
        : await fetch(req);
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
