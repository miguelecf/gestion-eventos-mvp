/**
 * ===================================================================
 * SELECTOR DE ESPACIOS PUBLICOS
 * ===================================================================
 * Selector dropdown para espacios disponibles en solicitudes publicas.
 * ===================================================================
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { publicRequestsApi } from '@/services/api';
import type { PublicSpaceOption } from '@/services/api/publicRequests.api';

export interface PublicSpaceSelectProps {
  id?: string;
  value?: number | null;
  onChange: (spaceId: number | null) => void;
  disabled?: boolean;
  className?: string;
  ariaInvalid?: boolean;
  placeholder?: string;
  error?: string;
}

const PublicSpaceSelect = React.forwardRef<HTMLSelectElement, PublicSpaceSelectProps>(
  (
    {
      id,
      value,
      onChange,
      disabled,
      className,
      ariaInvalid,
      placeholder = 'Seleccionar espacio...',
      error,
      ...rest
    },
    ref
  ) => {
    const [spaces, setSpaces] = useState<PublicSpaceOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;

      publicRequestsApi
        .getPublicSpaces({ publishableOnly: true })
        .then((data) => {
          if (cancelled) {
            return;
          }

          setSpaces(data);
          setLoadError(null);
        })
        .catch((err) => {
          if (cancelled) {
            return;
          }

          console.error('Error cargando espacios publicos:', err);
          setLoadError('No se pudieron cargar los espacios disponibles');
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []);

    return (
      <div className="w-full">
        <select
          id={id}
          ref={ref}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled || loading}
          aria-invalid={ariaInvalid || !!error ? true : undefined}
          className={cn(
            'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none',
            'focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary',
            'disabled:cursor-not-allowed disabled:opacity-60',
            ariaInvalid || error ? 'border-red-500' : 'border-input',
            className
          )}
          {...rest}
        >
          <option value="">
            {loading ? 'Cargando espacios...' : loadError || placeholder}
          </option>
          {!loadError &&
            spaces.map((space) => (
              <option key={space.value} value={space.value}>
                {space.label}
              </option>
            ))}
        </select>

        {loadError && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {loadError}
          </p>
        )}

        {!loading && !loadError && spaces.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            No hay espacios disponibles en este momento
          </p>
        )}
      </div>
    );
  }
);

PublicSpaceSelect.displayName = 'PublicSpaceSelect';

export { PublicSpaceSelect };
export default PublicSpaceSelect;
