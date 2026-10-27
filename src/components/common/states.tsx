import { AlertTriangle, Inbox, Lock, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <div className="max-w-md text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Error panel for failed queries. 403/404 get specific wording (out-of-scope resources are 404). */
export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const status = isApiError(error) ? error.status : undefined;
  const network = isApiError(error) && error.isNetwork;
  const Icon = status === 403 ? Lock : network ? WifiOff : AlertTriangle;
  const heading =
    title ??
    (status === 403
      ? "You don't have access to this"
      : status === 404
        ? "Not found"
        : network
          ? "Can't reach the attendance service"
          : "Couldn't load this data");
  const detail =
    status === 404
      ? "It may not exist, or it belongs to a CDS group outside your access."
      : errorMessage(error);
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-danger-soft">
        <Icon className="size-5 text-destructive" />
      </div>
      <p className="text-sm font-medium">{heading}</p>
      <p className="max-w-md text-sm text-muted-foreground">{detail}</p>
      {requestId && <p className="font-mono text-xs text-muted-foreground">Request ID: {requestId}</p>}
      {onRetry && status !== 403 && status !== 404 && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-sm text-destructive">
      {errorMessage(error)}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-40" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-24 w-full", className)} />;
}

export function NoAccess({ what = "this page" }: { what?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title={`You don't have access to ${what}`}
      description="Your role does not include this area. Contact a super administrator if you need access."
    />
  );
}
