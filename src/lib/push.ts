'use client';

/**
 * Client-side push helpers. Wraps the Notification permission dance and the
 * PushManager subscription in something that reads like normal code.
 */

export type PushStatus =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied'
  | 'subscribed';

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Reads current permission + subscription state without prompting. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  const permission = Notification.permission;
  if (permission === 'denied') return 'denied';
  if (permission === 'default') return 'default';

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? 'subscribed' : 'granted';
}

/** VAPID public keys are base64url; PushManager wants a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  // Explicitly back the Uint8Array with an ArrayBuffer (not SharedArrayBuffer),
  // because PushManager.subscribe.applicationServerKey requires exactly that.
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Prompts for permission if needed, subscribes with the browser's push server,
 * and posts the subscription to our /api/push/subscribe endpoint.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    return { ok: false, error: 'This browser does not support push.' };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return { ok: false, error: 'Push is not configured on the server.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Permission was not granted.' };
  }

  const registration = await navigator.serviceWorker.ready;

  // If there's already a subscription for a different VAPID key (which happens
  // when we rotate keys), unsubscribe first to avoid a mismatch.
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });

  if (!response.ok) {
    // Roll back the browser subscription so we're not out of sync with the DB.
    try {
      await subscription.unsubscribe();
    } catch {
      // ignore
    } 
    return { ok: false, error: 'Could not save your subscription. Try again.' };
  }

  return { ok: true };
}

/** Unsubscribe both in the browser   and on the server. */
export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: false };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
  return { ok: true };
}