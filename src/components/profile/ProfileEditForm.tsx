'use client';

import { useState } from 'react';
import { updateProfileAction } from '@/server/actions/profile';
import ui from '@/components/ui/ui.module.css';

interface Initial {
  full_name: string;
  phone: string;
  usual_donation_times: string;
  bio: string;
}

export function ProfileEditForm({ initial }: { initial: Initial }) {
  const [values, setValues] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await updateProfileAction(values);
    setSaving(false);
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.error });
      return;
    }
    setMessage({ kind: 'ok', text: 'Saved.' });
  }

  return (
    <form className={ui.stack} onSubmit={submit}>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="edit-name">
          Name
        </label>
        <input
          id="edit-name"
          className={ui.input}
          value={values.full_name}
          maxLength={80}
          required
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
        />
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="edit-phone">
          Phone
        </label>
        <input
          id="edit-phone"
          type="tel"
          autoComplete="tel"
          className={ui.input}
          value={values.phone}
          maxLength={20}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
        />
        <p className={ui.hint}>
          Shared only with the person you are matched with, only while the handover is live.
        </p>
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="edit-times">
          When you usually donate
        </label>
        <input
          id="edit-times"
          className={ui.input}
          value={values.usual_donation_times}
          maxLength={120}
          onChange={(e) => setValues((v) => ({ ...v, usual_donation_times: e.target.value }))}
        />
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="edit-bio">
          About you
        </label>
        <textarea
          id="edit-bio"
          className={ui.textarea}
          value={values.bio}
          maxLength={400}
          onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
        />
      </div>

      {message ? (
        message.kind === 'ok' ? (
          <p className={ui.notice} role="status">
            {message.text}
          </p>
        ) : (
          <p className={ui.formError} role="alert">
            {message.text}
          </p>
        )
      ) : null}

      <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}