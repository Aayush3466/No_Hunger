import styles from './ui.module.css';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.cardBody}>{body}</p>
      {action ? <div style={{ marginTop: '1.25rem' }}>{action}</div> : null}
    </div>
  );
}
