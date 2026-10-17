import { t } from "../../../shared/lib/i18n.ts";
import { Field } from "../../../shared/ui/Field.tsx";
import { SearchInput } from "../../../shared/ui/SearchInput.tsx";
import { Select } from "../../../shared/ui/Select.tsx";
import { Switch } from "../../../shared/ui/Switch.tsx";
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
      <div className={styles.search}>
        <Field label={t("home.filters.search")} error={null}>
          {(control) => (
            <SearchInput {...control} value={search} onChange={(event) => onSearchChange(event.target.value)} />
          )}
        </Field>
      </div>
      <div className={styles.tag}>
        <Field label={t("home.filters.tag")} error={null}>
          {(control) => (
            <Select
              {...control}
              value={tag ?? ""}
              onChange={(event) => onTagChange(event.target.value === "" ? null : event.target.value)}
            >
              <option value="">{t("home.filters.allTags")}</option>
              {tags.map((existing) => (
                <option key={existing} value={existing}>
                  {existing}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Switch label={t("home.filters.sortByState")} checked={isSortedByState} onChange={onSortByStateChange} />
    </div>
  );
}
