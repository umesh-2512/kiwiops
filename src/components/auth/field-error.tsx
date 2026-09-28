export function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  if (!errors?.length) return null;
  return (
    <div className="field-error" id={id} role="alert">
      {errors.map((error) => <span key={error}>{error}</span>)}
    </div>
  );
}
