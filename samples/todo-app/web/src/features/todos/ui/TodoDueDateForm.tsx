import { useState, type FormEvent, type KeyboardEvent } from "react";
import { t } from "../../../shared/lib/i18n.ts";
import { Button } from "../../../shared/ui/Button.tsx";
import { DateInput } from "../../../shared/ui/DateInput.tsx";
import { ErrorMessage } from "../../../shared/ui/ErrorMessage.tsx";
import { Field } from "../../../shared/ui/Field.tsx";
import styles from "./TodoDueDateForm.module.css";

export function TodoDueDateForm({
  todoName,
  dueDate,
  onSubmit,
  onClose,
}: {
  todoName: string;
  dueDate: string | null;
  onSubmit(dueDate: string | null): Promise<void>;
  onClose(): void;
}) {
  const [value, setValue] = useState(dueDate ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  async function save(next: string | null) {
    setIsSaving(true);
    setHasFailed(false);
    try {
      await onSubmit(next);
      onClose();
    } catch {
      setHasFailed(true);
      setIsSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(value === "" ? null : value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && !isSaving) onClose();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <div className={styles.field}>
        <Field label={t("home.dueDate.label", { name: todoName })} error={null}>
          {(control) => (
            <DateInput {...control} name="dueDate" value={value} onChange={(event) => setValue(event.target.value)} />
          )}
        </Field>
      </div>
      <Button variant="primary" type="submit" disabled={isSaving}>
        {t("home.dueDate.save")}
      </Button>
      {dueDate !== null && (
        <Button variant="quiet" disabled={isSaving} onClick={() => void save(null)}>
          {t("home.dueDate.clear")}
        </Button>
      )}
      <Button variant="subtle" disabled={isSaving} onClick={onClose}>
        {t("home.dueDate.cancel")}
      </Button>
      {hasFailed && (
        <div className={styles.error}>
          <ErrorMessage>{t("common.error.generic")}</ErrorMessage>
        </div>
      )}
    </form>
  );
}
