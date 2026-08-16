/* eslint-disable @next/next/no-img-element */
import styles from './ui.module.css';

export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={styles.avatar}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  );
}
