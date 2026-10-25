/** Re-mounts on every navigation, so each page fades in instead of snapping into place. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col animate-page-in">{children}</div>;
}
