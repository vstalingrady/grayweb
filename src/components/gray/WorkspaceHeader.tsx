import { Flame } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";

type GrayWorkspaceHeaderProps = {
  timeLabel: string;
  dateLabel: string;
  streakCount: number;
};

export function GrayWorkspaceHeader({
  timeLabel,
  dateLabel,
  streakCount,
}: GrayWorkspaceHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.timeGroup}>
        <span className={styles.time}>{timeLabel}</span>
        <span className={styles.date}>{dateLabel}</span>
      </div>
      <div className={styles.headerRight}>
        <div className={styles.streakBadge}>
          <Flame size={12} />
          <span>{String(streakCount).padStart(2, "0")} day streak</span>
        </div>
      </div>
    </header>
  );
}
