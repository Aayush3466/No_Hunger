'use client';

import { useActionState } from 'react';
import { completeOnboardingAction } from '@/server/actions/auth';
import { EMPTY_FORM_STATE } from '@/server/actions/form-state';
import styles from '@/components/ui/ui.module.css';

export function OnboardingForm({
  next,
  defaultName,
}: {
  next: string;
  defaultName?: string | null;
}) {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className={styles.stack}>
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="full_name">
          Name
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          maxLength={80}
          defaultValue={defaultName ?? ''}
          className={styles.input}
          aria-invalid={state.fields?.full_name ? true : undefined}
        />
        {state.fields?.full_name ? (
          <p className={styles.error}>{state.fields.full_name}</p>
        ) : (
          <p className={styles.hint}>This is what neighbours see next to your listings.</p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          className={styles.input}
          aria-invalid={state.fields?.phone ? true : undefined}
        />
        {state.fields?.phone ? (
          <p className={styles.error}>{state.fields.phone}</p>
        ) : (
          <p className={styles.hint}>
            Shared only with the person you are matched with, only while the handover is live.
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="usual_donation_times">
          When you usually donate
        </label>
        <input
          id="usual_donation_times"
          name="usual_donation_times"
          maxLength={120}
          placeholder="Weekday evenings after 8pm"
          className={styles.input}
        />
        <p className={styles.hint}>Optional. Helps neighbours know when to look out for you.</p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="bio">
          About you
        </label>
        <textarea id="bio" name="bio" maxLength={400} className={styles.textarea} />
        <p className={styles.hint}>Optional.</p>
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Saving…' : 'Save and continue'}
      </button>
    </form>
  );
}
