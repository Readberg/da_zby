import { Loader } from "@/components/ui/loader";

/**
 * Loading placeholder; size it with classes (`h-6 w-40`, `aspect-video`, …). It shows the site's
 * own loader instead of a grey box, so every waiting block says that it is loading.
 */
export function Skeleton({ className, label }: { className?: string; label?: string }) {
  return <Loader className={className} label={label} />;
}
