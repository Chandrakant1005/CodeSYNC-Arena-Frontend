export default function AuthForm({
  fields,
  values,
  onChange,
  onSubmit,
  submitLabel,
  error,
  busy
}) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {fields.map((field) => (
        <label key={field.name} className="field">
          <span>{field.label}</span>
          <input
            type={field.type}
            name={field.name}
            value={values[field.name]}
            onChange={onChange}
            placeholder={field.placeholder}
            required
          />
        </label>
      ))}
      {error ? <div className="form-error">{error}</div> : null}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? "Please wait..." : submitLabel}
      </button>
    </form>
  );
}
