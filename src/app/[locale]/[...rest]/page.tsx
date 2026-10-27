import { notFound } from "next/navigation";

/** Any address that matches no page: the localized 404 inside the layout of its language. */
export default function UnknownPage() {
  notFound();
}
