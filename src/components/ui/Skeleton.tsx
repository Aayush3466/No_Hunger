import styles from './ui.module.css';

/** Skeletons, never spinners: the layout should not jump when data lands. */
export function Skeleton({
  height = 16,
  width = '100%',
  radius,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number | string;
}) {
  return (
    <div
      className={styles.skeleton}
      style={{ height, width, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function DonationCardSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <Skeleton height={56} width={56} radius="var(--nh-radius-md)" />
        <div className={styles.grow}>
          <Skeleton height={18} width="60%" />
          <div style={{ height: 8 }} />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
    </div>
  );
}
