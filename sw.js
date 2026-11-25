const CACHE = 'viks-shell-v3';
const STATIC = 'viks-static-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = r.url;
  if (r.mode !== 'navigate') {
    if (/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//.test(u) || /\/storage\/v1\/object\/public\/avatars\//.test(u) || /\/icon[^/]*\.(png|svg)$/.test(u)) {
      e.respondWith(caches.open(STATIC).then(async c => {
        const hit = await c.match(r);
        const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }));
    }
    return;
  }
  e.respondWith(fetch(r).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put('./', copy)).catch(() => {});
    return res;
  }).catch(() => caches.match('./').then(m => m || new Response('<h3 style="font-family:sans-serif;color:#fff;background:#0b0a14;padding:40px">Нет интернета. Viks откроется, как появится сеть.</h3>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'Viks', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(w => w.focused && w.visibilityState === 'visible')) return;
    let prev = 0; try { const old = await self.registration.getNotifications({ tag: d.tag }); old.forEach(n => { prev += (n.data && n.data.n) || 1; }); } catch {}
    const n = prev + 1;
    await self.registration.showNotification(d.title || 'Viks', {
      body: (n > 1 ? '(' + n + ') ' : '') + (d.body || ''), icon: d.icon || 'icon-192.png', badge: 'icon-192.png', image: d.image || undefined, tag: d.tag, renotify: !d.quiet, silent: !!d.quiet,
      data: { chat_id: d.chat_id, n }, vibrate: d.quiet ? [] : [60, 40, 60], timestamp: Date.now(),
      actions: d.chat_id ? [{ action: 'reply', title: '↩ Ответить' }, { action: 'open', title: 'Открыть' }] : []
    });
    try { const all = await self.registration.getNotifications(); let tot = 0; all.forEach(x => tot += (x.data && x.data.n) || 1); if (self.navigator.setAppBadge) await self.navigator.setAppBadge(tot); } catch {}
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = e.action && e.action.startsWith('c:') ? e.action.slice(2) : e.notification.data && e.notification.data.chat_id, reply = e.action === 'reply';
  e.waitUntil((async () => {
    try { const all = await self.registration.getNotifications(); let tot = 0; all.forEach(x => tot += (x.data && x.data.n) || 1); if (self.navigator.setAppBadge) { if (tot) await self.navigator.setAppBadge(tot); else await self.navigator.clearAppBadge(); } } catch {}
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { try { await w.focus(); if (id) w.postMessage({ open: id, reply }); return; } catch {} }
    await self.clients.openWindow('./' + (id ? '?chat=' + id + (reply ? '&reply=1' : '') : ''));
  })());
});
