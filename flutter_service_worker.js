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

/// Coquille commune aux deux moteurs : injectée au build par
/// tool/finaliser_web.sh (chemins relatifs au service worker).
const COQUILLE = ["./", "assets/AssetManifest.bin", "assets/AssetManifest.bin.json", "assets/FontManifest.json", "assets/assets/fonts/Bricolage-Bold.ttf", "assets/assets/fonts/Bricolage-ExtraBold.ttf", "assets/assets/fonts/Manrope-ExtraBold.ttf", "assets/assets/fonts/Manrope-Regular.ttf", "assets/assets/fonts/Manrope-SemiBold.ttf", "assets/assets/fonts/NotoColorEmoji.ttf", "assets/assets/monuments.json", "assets/assets/quests.json", "assets/assets/world_countries.json", "assets/assets/world_land.json", "assets/fonts/MaterialIcons-Regular.otf", "assets/packages/flutter_local_notifications_web/web/notifications_service_worker.js", "assets/shaders/ink_sparkle.frag", "assets/shaders/stretch_effect.frag", "drift_worker.js", "favicon.png", "flutter.js", "flutter_bootstrap.js", "icons/Icon-192.png", "icons/Icon-maskable-192.png", "icons/apple-touch-icon.png", "index.html", "manifest.json", "sqlite3.wasm"];

/// Délai au-delà duquel on renonce à remplir le cache. Un worker qui a des
/// requêtes en cours empêche le suivant de prendre la main : jamais de
/// remplissage sans fin.
const DELAI_REMPLISSAGE_MS = 90000;

self.addEventListener('install', (event) => {
  // Prendre la main tout de suite : la version fraîchement déployée ne doit
  // pas attendre la fermeture de tous les onglets pour s'activer.
  self.skipWaiting();
  // Hors ligne dès la première visite : la coquille est rangée maintenant,
  // pas au gré des requêtes (la page et ses données arrivent avant que le
  // worker ne prenne la main, elles n'étaient jamais mises en cache).
  // Une erreur ici n'empêche pas l'installation : le cache se complétera
  // à l'usage, comme avant.
  event.waitUntil(remplir(Array.isArray(COQUILLE) ? COQUILLE : []));
});

/// La page signale les fichiers du moteur qu'elle a vraiment chargés
/// (WebAssembly ou JavaScript selon le navigateur) : on les range aussi.
self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type !== 'moteur' || d.version !== VERSION) return;
  event.waitUntil(remplir(d.urls || []));
});

/// Range [urls] dans le cache de la coquille, sans écraser ce qui y est.
///
/// Chaque fichier est revalidé auprès du serveur (`no-cache`), qui sert la
/// version déployée ; si ce n'est plus celle de ce worker (un déploiement est
/// passé entre-temps), on s'abstient : le cache ne doit contenir que des
/// fichiers d'une seule et même version.
async function remplir(urls) {
  const travail = (async () => {
    const page = await fraisDuServeur(new Request('./'));
    if (!page.ok) return;
    const trouve = (await page.clone().text())
      .match(/flutter_service_worker\.js\?v=([0-9A-Za-z]+)/);
    if (!trouve || trouve[1] !== VERSION) return;
    const cache = await caches.open(CACHE_APP);
    await cache.put('./', page);
    await Promise.allSettled(urls.map(async (u) => {
      const url = new URL(u, self.location);
      const memeOrigine = url.origin === self.location.origin;
      if (!memeOrigine && !/gstatic\.com/.test(url.hostname)) return;
      if (EST_MEDIA.test(url.pathname)) return;
      if (await cache.match(url.href)) return;
      const reponse = memeOrigine
        ? await fraisDuServeur(new Request(url.href))
        : await fetch(url.href);
      if (reponse.ok || reponse.type === 'opaque') {
        await cache.put(url.href, reponse);
      }
    }));
  })();
  await Promise.race([
    travail.catch(() => {}),
    new Promise((fin) => setTimeout(fin, DELAI_REMPLISSAGE_MS)),
  ]);
}

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

  // Pas de passage forcé au réseau quand ce service worker se sait périmé :
  // essayé, le long téléchargement du moteur par l'ANCIEN worker, pendant que
  // le nouveau attendait de prendre la main, bloquait le démarrage (constaté
  // le 6 octobre). Le cache sert la coquille instantanément ; la nouvelle
  // version arrive au passage suivant, comme pour toute PWA.
  event.respondWith(
    cacheDAbord(req, EST_MEDIA.test(url.pathname) ? CACHE_MEDIA : CACHE_APP),
  );
});

/// Réseau d'abord, cache en filet de sécurité (hors ligne, avion, tunnel).
async function reseauDAbord(req) {
  try {
    const reponse = await fraisDuServeur(req);
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
