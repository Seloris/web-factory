import { t } from "../../../shared/lib/i18n.ts";
import styles from "./TodoFilters.module.css";

export function TodoFilters({
  search,
  tags,
  tag,
  isSortedByState,
  onSearchChange,
  onTagChange,
  onSortByStateChange,
}: {
  search: string;
  tags: string[];
  tag: string | null;
  isSortedByState: boolean;
  onSearchChange(search: string): void;
  onTagChange(tag: string | null): void;
  onSortByStateChange(isSortedByState: boolean): void;
}) {
  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>{t("home.filters.search")}</span>
        <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </label>
      <label className={styles.field}>
        <span>{t("home.filters.tag")}</span>
        <select value={tag ?? ""} onChange={(event) => onTagChange(event.target.value === "" ? null : event.target.value)}>
          <option value="">{t("home.filters.allTags")}</option>
          {tags.map((existing) => (
            <option key={existing} value={existing}>
              {existing}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={isSortedByState}
          onChange={(event) => onSortByStateChange(event.target.checked)}
        />
        <span>{t("home.filters.sortByState")}</span>
      </label>
    </div>
  );
}
