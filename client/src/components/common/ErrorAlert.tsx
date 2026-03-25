import { AlertTriangle } from "lucide-react";

interface Props {
  message: string;
}

export function ErrorAlert({ message }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
      <AlertTriangle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}
