'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { magicLinkAction, signInAction, signUpAction } from '@/server/actions/auth';
import { EMPTY_FORM_STATE, type FormState } from '@/server/actions/form-state';
import styles from '@/components/ui/ui.module.css';

type Tab = 'signin' | 'signup';

function FormMessages({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className={styles.formError} role="alert">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p className={styles.notice} role="status">
        {state.notice}
      </p>
    );
  }
  return null;
}

function EmailPasswordFields({
  state,
  defaultEmail,
  passwordAutoComplete,
  idPrefix,
}: {
  state: FormState;
  defaultEmail?: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  idPrefix: string;
}) {
  const emailId = `${idPrefix}-email`;
  const passwordId = `${idPrefix}-password`;

  return (
    <>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={emailId}>
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          className={styles.input}
          aria-invalid={state.fields?.email ? true : undefined}
          aria-describedby={state.fields?.email ? `${emailId}-error` : undefined}
        />
        {state.fields?.email ? (
          <p id={`${emailId}-error`} className={styles.error}>
            {state.fields.email}
          </p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={passwordId}>
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={passwordAutoComplete}
          className={styles.input}
          aria-invalid={state.fields?.password ? true : undefined}
          aria-describedby={state.fields?.password ? `${passwordId}-error` : undefined}
        />
        {state.fields?.password ? (
          <p id={`${passwordId}-error`} className={styles.error}>
            {state.fields.password}
          </p>
        ) : (
          <p className={styles.hint}>At least 8 characters.</p>
        )}
      </div>
    </>
  );
}

export function LoginForm({ next, defaultEmail }: { next: string; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, EMPTY_FORM_STATE);
  const [linkState, linkAction, linkPending] = useActionState(magicLinkAction, EMPTY_FORM_STATE);

  return (
    <div className={styles.stack}>
      <form action={formAction} className={styles.stack}>
        <input type="hidden" name="next" value={next} />
        <FormMessages state={state} />
        <EmailPasswordFields
          state={state}
          defaultEmail={defaultEmail}
          passwordAutoComplete="current-password"
          idPrefix="signin"
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <form action={linkAction} className={styles.stack}>
        <input type="hidden" name="next" value={next} />
        <FormMessages state={linkState} />
        <div className={styles.field}>
          <label className={styles.label} htmlFor="magic-email">
            Or get a one-time link
          </label>
          <input
            id="magic-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={defaultEmail}
            className={styles.input}
          />
        </div>
        <button type="submit" className="btn btn-outline btn-block" disabled={linkPending}>
          {linkPending ? 'Sending…' : 'Email me a link'}
        </button>
      </form>
    </div>
  );
}

export function SignupForm({ next, defaultEmail }: { next: string; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState(signUpAction, EMPTY_FORM_STATE);

  return (
    <div className={styles.stack}>
      <form action={formAction} className={styles.stack}>
        <input type="hidden" name="next" value={next} />
        <FormMessages state={state} />
        <EmailPasswordFields
          state={state}
          defaultEmail={defaultEmail}
          passwordAutoComplete="new-password"
          idPrefix="signup"
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

export function AuthTabs({
  next,
  defaultEmail,
  initialTab = 'signin',
}: {
  next: string;
  defaultEmail?: string;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className={styles.authCard}>
      <div className={styles.authTabs} role="tablist" aria-label="Sign in or create account">
        <button
          type="button"
          role="tab"
          id="tab-signin"
          aria-selected={tab === 'signin'}
          aria-controls="panel-signin"
          className={tab === 'signin' ? `${styles.authTab} ${styles.authTabActive}` : styles.authTab}
          onClick={() => setTab('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          id="tab-signup"
          aria-selected={tab === 'signup'}
          aria-controls="panel-signup"
          className={tab === 'signup' ? `${styles.authTab} ${styles.authTabActive}` : styles.authTab}
          onClick={() => setTab('signup')}
        >
          Create account
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-signin"
        aria-labelledby="tab-signin"
        hidden={tab !== 'signin'}
        className={styles.authPanel}
      >
        <LoginForm next={next} defaultEmail={defaultEmail} />
      </div>

      <div
        role="tabpanel"
        id="panel-signup"
        aria-labelledby="tab-signup"
        hidden={tab !== 'signup'}
        className={styles.authPanel}
      >
        <SignupForm next={next} defaultEmail={defaultEmail} />
      </div>
    </div>
  );
}