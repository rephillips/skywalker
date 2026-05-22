import { AlertTriangle } from "lucide-react";

interface Props {
  message: string;
  hint?: string;
}

export function ErrorAlert({ message, hint }: Props) {
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
      {hint && (
        <p className="mt-1.5 ml-7 text-[11px] text-amber-400/80">{hint}</p>
      )}
    </div>
  );
}
