import {
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  Search,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PublicAccessPanelProps = {
  variant: "desktop" | "mobile";
  className?: string;
};

const TRACKING_CODE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PublicAccessPanel({
  variant,
  className,
}: PublicAccessPanelProps) {
  const navigate = useNavigate();
  const [isTrackingDialogOpen, setIsTrackingDialogOpen] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const trackingInputId = useId();
  const trackingErrorId = useId();
  const isDesktop = variant === "desktop";
  const desktopSecondaryButtonClassName =
    "h-auto min-h-12 w-full rounded-xl border border-white/20 bg-white/5 px-6 py-2.5 text-center whitespace-normal leading-tight !text-white no-underline hover:bg-white/10 hover:!text-white hover:no-underline";
  const mobileSecondaryButtonClassName =
    "h-auto min-h-11 w-full rounded-xl border-[#6f1717]/15 bg-white/80 py-2.5 text-center whitespace-normal leading-tight !text-[#6f1717] no-underline hover:bg-[#f7eded] hover:!text-[#6f1717] hover:no-underline dark:border-white/15 dark:bg-white/10 dark:!text-white dark:hover:bg-white/15 dark:hover:!text-white";
  const desktopPrimaryButtonClassName =
    "h-12 w-full rounded-xl bg-white px-6 !text-[#6f1717] no-underline shadow-lg shadow-black/10 hover:bg-white/90 hover:no-underline";
  const mobilePrimaryButtonClassName =
    "h-11 w-full rounded-xl bg-[#6f1717] !text-white no-underline shadow-lg shadow-[#6f1717]/20 hover:bg-[#5b1111] hover:no-underline dark:bg-white dark:!text-[#6f1717] dark:hover:bg-white/90";

  const handleTrackingDialogChange = (open: boolean) => {
    setIsTrackingDialogOpen(open);

    if (!open) {
      setTrackingCode("");
      setTrackingError(null);
    }
  };

  const handleTrackingCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTrackingCode(event.target.value);

    if (trackingError) {
      setTrackingError(null);
    }
  };

  const handleTrackingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTrackingCode = trackingCode.trim();

    if (!nextTrackingCode) {
      setTrackingError("Ingresá un código de seguimiento.");
      return;
    }

    if (!TRACKING_CODE_PATTERN.test(nextTrackingCode)) {
      setTrackingError("Ingresá un código válido en formato UUID.");
      return;
    }

    handleTrackingDialogChange(false);
    navigate(`/track/${nextTrackingCode}`);
  };

  if (isDesktop) {
    return (
      <>
        <div className={cn("relative z-10 flex h-full flex-col gap-8", className)}>
          <div className="flex flex-1 items-center">
            <div className="w-full space-y-8">
              <div className="max-w-xl space-y-4">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.28em] text-white/80 backdrop-blur">
                  SOLICITUD PÚBLICA
                </span>
                <h1 className="max-w-lg text-4xl font-semibold leading-tight xl:text-5xl">
                  Solicitá y seguí tu evento desde un solo lugar
                </h1>
              </div>

              <div className="max-w-xl rounded-[1.75rem] border border-white/15 bg-white/10 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                      SOLICITUD PÚBLICA
                    </p>
                    <h3 className="text-3xl font-semibold">Solicitá tu evento</h3>
                    <p className="max-w-lg text-base leading-7 text-white/80">
                      Completá el formulario público si no tenés usuario y seguí
                      el estado de tu solicitud.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Button
                      asChild
                      size="lg"
                      className={desktopPrimaryButtonClassName}
                    >
                      <Link to="/solicitud">
                        Solicitar evento
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      onClick={() => handleTrackingDialogChange(true)}
                      className={desktopSecondaryButtonClassName}
                    >
                      Seguir solicitud
                    </Button>

                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className={desktopSecondaryButtonClassName}
                    >
                      <Link to="/public/calendar">Ver calendario público</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <UserRound className="h-5 w-5 text-white/75" />
              <p className="mt-4 text-sm text-white/65">Acceso</p>
              <p className="mt-1 text-lg font-semibold">Sin usuario</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <FileText className="h-5 w-5 text-white/75" />
              <p className="mt-4 text-sm text-white/65">Formulario</p>
              <p className="mt-1 text-lg font-semibold">Solicitud pública</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <Search className="h-5 w-5 text-white/75" />
              <p className="mt-4 text-sm text-white/65">Seguimiento</p>
              <p className="mt-1 text-lg font-semibold">Con código</p>
            </div>
          </div>
        </div>

        <TrackingDialog
          open={isTrackingDialogOpen}
          onOpenChange={handleTrackingDialogChange}
          onSubmit={handleTrackingSubmit}
          trackingCode={trackingCode}
          trackingError={trackingError}
          trackingInputId={trackingInputId}
          trackingErrorId={trackingErrorId}
          onTrackingCodeChange={handleTrackingCodeChange}
          tone="dark"
        />
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "rounded-[1.75rem] border border-[#6f1717]/10 bg-gradient-to-br from-[#f7eded] via-white to-slate-50 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(111,23,23,0.24),rgba(15,23,42,0.96))] dark:shadow-[0_20px_60px_rgba(2,6,23,0.35)]",
          className,
        )}
      >
        <div className="space-y-4">
          <span className="inline-flex rounded-full border border-[#6f1717]/10 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#6f1717] dark:border-white/15 dark:bg-white/10 dark:text-white/80">
            SOLICITUD PÚBLICA
          </span>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Solicitá tu evento
            </h2>
            <p className="text-sm leading-6 text-slate-600 dark:text-white/75">
              Completá el formulario público si no tenés usuario y seguí el
              estado de tu solicitud.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              asChild
              className={mobilePrimaryButtonClassName}
            >
              <Link to="/solicitud">
                Solicitar evento
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleTrackingDialogChange(true)}
              className={mobileSecondaryButtonClassName}
            >
              Seguir solicitud
            </Button>

            <Button
              asChild
              variant="outline"
              className={mobileSecondaryButtonClassName}
            >
              <Link to="/public/calendar">Ver calendario público</Link>
            </Button>
          </div>
        </div>
      </div>

      <TrackingDialog
        open={isTrackingDialogOpen}
        onOpenChange={handleTrackingDialogChange}
        onSubmit={handleTrackingSubmit}
        trackingCode={trackingCode}
        trackingError={trackingError}
        trackingInputId={trackingInputId}
        trackingErrorId={trackingErrorId}
        onTrackingCodeChange={handleTrackingCodeChange}
        tone="light"
      />
    </>
  );
}

type TrackingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  trackingCode: string;
  trackingError: string | null;
  trackingInputId: string;
  trackingErrorId: string;
  onTrackingCodeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  tone: "dark" | "light";
};

function TrackingDialog({
  open,
  onOpenChange,
  onSubmit,
  trackingCode,
  trackingError,
  trackingInputId,
  trackingErrorId,
  onTrackingCodeChange,
  tone,
}: TrackingDialogProps) {
  const isDarkTone = tone === "dark";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden rounded-[1.75rem] p-0 shadow-[0_32px_80px_rgba(15,23,42,0.22)]",
          isDarkTone
            ? "border border-white/10 bg-slate-950/95 text-white"
            : "border border-slate-200/80 bg-white/95 text-slate-900 dark:border-slate-800 dark:bg-slate-900/95 dark:text-white",
        )}
      >
        <form onSubmit={onSubmit} className="space-y-6 p-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold">
              Seguir solicitud
            </DialogTitle>
            <DialogDescription
              className={cn(
                "text-sm leading-6",
                isDarkTone ? "text-white/70" : "text-slate-500 dark:text-slate-400",
              )}
            >
              Ingresá tu código de seguimiento para ver el estado actual de tu
              solicitud.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor={trackingInputId}
              className={cn(
                "block text-sm font-medium",
                isDarkTone ? "text-white/85" : "text-slate-700 dark:text-slate-300",
              )}
            >
              Ingresá tu código de seguimiento
            </label>

            <Input
              id={trackingInputId}
              type="text"
              value={trackingCode}
              onChange={onTrackingCodeChange}
              autoFocus
              aria-invalid={Boolean(trackingError)}
              aria-describedby={trackingError ? trackingErrorId : undefined}
              placeholder="Ej. a80dbd1e-ec9f-4e9a-849d-39e66730f754"
              className={cn(
                "h-12 rounded-xl",
                isDarkTone
                  ? "border-white/10 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-white/30 focus-visible:ring-white/20"
                  : "border-slate-200 bg-white focus-visible:border-slate-400 focus-visible:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-950 dark:focus-visible:border-slate-500",
              )}
            />

            {trackingError && (
              <p
                id={trackingErrorId}
                className={cn(
                  "text-sm",
                  isDarkTone ? "text-rose-300" : "text-rose-600 dark:text-rose-400",
                )}
              >
                {trackingError}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={cn(
                "h-11 rounded-xl",
                isDarkTone
                  ? "border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800",
              )}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              className={cn(
                "h-11 rounded-xl",
                isDarkTone
                  ? "bg-white text-[#6f1717] hover:bg-white/90"
                  : "bg-[#6f1717] text-white hover:bg-[#5b1111] dark:bg-white dark:text-[#6f1717] dark:hover:bg-white/90",
              )}
            >
              Ver seguimiento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
