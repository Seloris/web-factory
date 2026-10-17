import { useState, type FormEvent } from "react";
import type { ProblemDetails } from "../../../api/client.ts";
import { t } from "../../../shared/lib/i18n.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { Field } from "../../../shared/ui/Field.tsx";
import { TextInput } from "../../../shared/ui/TextInput.tsx";
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
      <div className={styles.name}>
        <Field label={t("home.form.name")} error={nameError}>
          {(control) => (
            <TextInput
              {...control}
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={200}
            />
          )}
        </Field>
      </div>
      <div className={styles.tag}>
        <Field label={t("home.form.tag")} error={tagError}>
          {(control) => (
            <>
              <TextInput
                {...control}
                name="tag"
                value={tag}
                onChange={(event) => setTag(event.target.value)}
                maxLength={30}
                list="todo-form-tags"
              />
              <datalist id="todo-form-tags">
                {tags.map((existing) => (
                  <option key={existing} value={existing} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </div>
      <Button variant="primary" type="submit" disabled={isPending}>
        {t("home.form.submit")}
      </Button>
      {otherError && (
        <div className={styles.formError}>
          <ErrorMessage>{otherError}</ErrorMessage>
        </div>
      )}
    </form>
  );
}
