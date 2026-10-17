import { useState, type FormEvent } from "react";
import type { ProblemDetails } from "../../../api/client.ts";
import { t } from "../../../shared/lib/i18n.ts";
import styles from "./TodoForm.module.css";

export function TodoForm({
  tags,
  isPending,
  problem,
  onSubmit,
}: {
  tags: string[];
  isPending: boolean;
  problem: ProblemDetails | null;
  onSubmit(values: { name: string; tag: string | null }): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [isNameBlank, setIsNameBlank] = useState(false);

  const nameError = isNameBlank
    ? t("home.form.nameRequired")
    : problem?.errors?.["body.name"]
      ? t("home.form.nameInvalid")
      : null;
  const tagError = problem?.errors?.["body.tag"] ? t("home.form.tagInvalid") : null;
  const otherError =
    problem && !problem.errors?.["body.name"] && !problem.errors?.["body.tag"]
      ? t("common.error.generic")
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim() === "") {
      setIsNameBlank(true);
      return;
    }
    setIsNameBlank(false);
    try {
      await onSubmit({ name, tag: tag === "" ? null : tag });
      setName("");
      setTag("");
    } catch {
      // The `problem` prop carries the failure; the fields stay for a retry.
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.field}>
        <span>{t("home.form.name")}</span>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={200}
          aria-invalid={nameError !== null}
          aria-describedby={nameError ? "todo-form-name-error" : undefined}
        />
        {nameError && (
          <span id="todo-form-name-error" className={styles.error}>
            {nameError}
          </span>
        )}
      </label>
      <label className={styles.field}>
        <span>{t("home.form.tag")}</span>
        <input
          name="tag"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          maxLength={30}
          list="todo-form-tags"
          aria-invalid={tagError !== null}
          aria-describedby={tagError ? "todo-form-tag-error" : undefined}
        />
        <datalist id="todo-form-tags">
          {tags.map((existing) => (
            <option key={existing} value={existing} />
          ))}
        </datalist>
        {tagError && (
          <span id="todo-form-tag-error" className={styles.error}>
            {tagError}
          </span>
        )}
      </label>
      <button type="submit" className={styles.submit} disabled={isPending}>
        {t("home.form.submit")}
      </button>
      {otherError && (
        <p role="alert" className={styles.error}>
          {otherError}
        </p>
      )}
    </form>
  );
}
