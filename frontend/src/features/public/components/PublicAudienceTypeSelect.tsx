/**
 * ===================================================================
 * SELECTOR DE TIPO DE AUDIENCIA PÚBLICA
 * ===================================================================
 * Selector dropdown con tipos de audiencia para solicitudes públicas.
 * Uses the same audience types as the backend.
 * ===================================================================
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { PublicAudienceType } from '@/schemas/eventPublic.schema';

const PUBLIC_AUDIENCE_TYPES = [
  { value: 'ESTUDIANTES', label: 'Estudiantes' },
  { value: 'DOCENTES', label: 'Docentes' },
  { value: 'AUTORIDADES', label: 'Autoridades' },
  { value: 'COMUNIDAD', label: 'Comunidad' },
  { value: 'TERCERA_EDAD', label: 'Tercera edad' },
] as const;

export interface PublicAudienceTypeSelectProps {
  value: PublicAudienceType;
  onChange: (value: PublicAudienceType) => void;
  disabled?: boolean;
  className?: string;
  ariaInvalid?: boolean;
}

const PublicAudienceTypeSelect = React.forwardRef<HTMLSelectElement, PublicAudienceTypeSelectProps>(
  ({ value, onChange, disabled, className, ariaInvalid, ...rest }, ref) => {
    return (
      <select
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value as PublicAudienceType)}
        disabled={disabled}
        aria-invalid={ariaInvalid ? true : undefined}
        className={cn(
          'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none',
          'focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-60',
          ariaInvalid ? 'border-red-500' : 'border-input',
          className
        )}
        {...rest}
      >
        {PUBLIC_AUDIENCE_TYPES.map(({ value: optValue, label }) => (
          <option key={optValue} value={optValue}>
            {label}
          </option>
        ))}
      </select>
    );
  }
);

PublicAudienceTypeSelect.displayName = 'PublicAudienceTypeSelect';

export { PublicAudienceTypeSelect };
export default PublicAudienceTypeSelect;
