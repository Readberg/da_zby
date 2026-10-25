import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown at once while a page of the signed-in area is being prepared on the server. */
export function PageLoading() {
  return (
    <Container className="flex flex-col gap-4 py-8 sm:py-12">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 max-w-xl" />
    </Container>
  );
}
