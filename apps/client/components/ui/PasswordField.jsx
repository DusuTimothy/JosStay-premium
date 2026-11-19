"use client";

import { useId, useState } from "react";
import { Icon } from "./Icon";

export function PasswordField({
  label,
  error,
  hint,
  className = "",
  id,
  ...inputProps
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const [visible, setVisible] = useState(false);
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="block">
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          id={fieldId}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`field pr-12 ${error ? "!border-red-400" : ""} ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted transition hover:text-plum-700 focus-visible:text-plum-700 focus-visible:outline-none"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={fieldId}
          title={visible ? "Hide password" : "Show password"}
        >
          <Icon
            name={visible ? "eyeOff" : "eye"}
            className="h-[18px] w-[18px]"
            strokeWidth={1.9}
          />
        </button>
      </div>
      {error && (
        <span id={errorId} className="mt-1 block text-[11px] text-red-600">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="mt-1 block text-[11px] text-muted">
          {hint}
        </span>
      )}
    </div>
  );
}
