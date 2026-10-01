import styles from "./FieldError.module.css";

export function FieldError({ fieldId, message }: { fieldId: string; message: string }) {
  return (
    <p
      id={`${fieldId}-error`}
      className={styles.message}>
      {message}
    </p>
  );
}