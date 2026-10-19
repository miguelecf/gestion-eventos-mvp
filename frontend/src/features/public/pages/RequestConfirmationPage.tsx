/**
 * ===================================================================
 * PANTALLA DE CONFIRMACIÓN DE SOLICITUD
 * ===================================================================
 * Se muestra después de enviar exitosamente una solicitud pública.
 * Muestra el trackingUuid y próximos pasos.
 * ===================================================================
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RequestConfirmationPage() {
  const { trackingUuid } = useParams<{ trackingUuid: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Redirigir si no hay UUID
  useEffect(() => {
    if (!trackingUuid) {
      navigate('/solicitud');
    }
  }, [trackingUuid, navigate]);

  // Handler para copiar UUID
  const handleCopyUuid = () => {
    if (trackingUuid) {
      navigator.clipboard.writeText(trackingUuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!trackingUuid) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      {/* Ícono de éxito */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-green-600 dark:text-green-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Título y mensaje */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-3">¡Solicitud Enviada Exitosamente!</h1>
        <p className="text-lg text-muted-foreground">
          Su solicitud de evento ha sido recibida y será revisada por nuestro equipo.
        </p>
      </div>

      {/* Card con código de seguimiento */}
      <Card className="p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Código de Seguimiento</h2>
            <Badge>RECIBIDA</Badge>
          </div>

          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="text-sm">
                  Guarde este código para consultar el estado de su solicitud:
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono">
                    {trackingUuid}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyUuid}>
                    {copied ? (
                      <>
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Copiado
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </Card>

      {/* Próximos pasos */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Próximos Pasos</h2>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Revisión de solicitud</p>
              <p className="text-sm text-muted-foreground">
                El equipo de Ceremonial y Técnica revisará su solicitud en un plazo de 2-3 días
                hábiles.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Consulte el estado</p>
              <p className="text-sm text-muted-foreground">
                Use el código de seguimiento para ver el progreso de su solicitud en cualquier
                momento.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Respuesta y confirmación</p>
              <p className="text-sm text-muted-foreground">
                Recibirá un email con la decisión. Si se acepta, se convierte en un evento que
                aparecerá en el calendario público cuando Ceremonial y Técnica lo aprueben.
              </p>
            </div>
          </li>
        </ol>
      </Card>

      {/* Información de contacto */}
      <Alert className="mb-6">
        <AlertDescription>
          <p className="text-sm">
            <strong>¿Necesita ayuda?</strong>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Si tiene preguntas sobre su solicitud, puede contactarnos en{' '}
            <a
              href="mailto:ceremonial@universidad.edu"
              className="text-blue-600 hover:underline"
            >
              ceremonial@universidad.edu
            </a>{' '}
            o al teléfono (011) 1234-5678.
          </p>
        </AlertDescription>
      </Alert>

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild variant="default">
          <Link to={`/track/${trackingUuid}`}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Ver Estado de Solicitud
          </Link>
        </Button>

        <Button asChild variant="outline">
          <Link to="/public/calendar">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Ver Calendario Público
          </Link>
        </Button>

        <Button asChild variant="ghost">
          <Link to="/solicitud">Nueva Solicitud</Link>
        </Button>
      </div>
    </div>
  );
}
