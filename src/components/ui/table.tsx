import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cx } from "@/lib/cx";

/** Base table: compact on mobile, zebra rows; scrolls horizontally only as a last resort. */
export function Table({
  caption,
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { caption?: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-line p-1 sm:p-3">
      <table className={cx("w-full border-collapse text-sm sm:text-base", className)} {...props}>
        {caption && <caption className="mb-2 text-left text-sm text-muted">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b border-line text-muted" {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="[&>tr:nth-child(even)]:bg-surface" {...props} />;
}

export function TR({
  highlight,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { highlight?: boolean }) {
  return (
    <tr
      className={cx("border-b border-line", highlight && "font-semibold bg-accent/25!", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cx("px-2 py-2 text-left font-display uppercase sm:px-3", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("px-2 py-2 sm:px-3", className)} {...props} />;
}
