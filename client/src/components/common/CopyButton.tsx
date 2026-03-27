import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  text: string;
  size?: number;
}

export function CopyButton({ text, size = 12 }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={size} className="text-emerald-400" /> : <Copy size={size} />}
    </button>
  );
}
