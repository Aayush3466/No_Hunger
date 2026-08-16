'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getPushStatus,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from '@/lib/push';
import ui from '@/components/ui/ui.module.css';

export function PushNotifications() {
  const [status, setStatus] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getPushStatus());
  }, []);

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus('unsupported');
      return;
    }
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setError(null);
    const result = await subscribeToPush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
    }
    await refresh();
  }

  async function disable() {
    setBusy(true);
    setError(null);
    await unsubscribeFromPush();
    setBusy(false);
    await refresh();
  }

  if (status === 'unsupported') {
    return (
      <p className={ui.cardMeta}>
        This browser doesn&apos;t support push notifications. Add NoHunger to your home screen
        on iPhone or use Chrome/Firefox on Android to enable them.
      </p>
    );
  }

  if (status === 'denied') {
    return (
      <>
        <p className={ui.cardMeta}>
          Notifications are blocked in your browser settings. Change the site permission for
          this URL to “Allow” and reload.
        </p>
      </>
    );
  }

  if (status === 'subscribed') {
    return (
      <div className={ui.stack}>
        <p className={ui.cardMeta}>
          Notifications are on for this device. You&apos;ll get a nudge on your lock screen when
          a request lands or an order updates.
        </p>
        <button type="button" className="btn btn-outline" onClick={() => void disable()} disabled={busy}>
          {busy ? 'Turning off…' : 'Turn off notifications on this device'}
        </button>
      </div>
    );
  }

  return (
    <div className={ui.stack}>
      <p className={ui.cardMeta}>
        Get notified on your lock screen when someone requests your food, when a donor accepts
        your request, or when an order completes. No spam, only the events you care about.
      </p>
      {error ? (
        <p className={ui.formError} role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary" onClick={() => void enable()} disabled={busy}>
        {busy ? 'Setting up…' : 'Enable notifications'}
      </button>
    </div>
  );
}