import { Container } from "@/components/ui/container";
import { Loader } from "@/components/ui/loader";

/**
 * Shown instead of the page while it is being prepared (route loading state): the content stays
 * out of sight until it is ready.
 */
export function PageLoading() {
  return (
    <Container className="flex flex-1 items-center justify-center py-24">
      <Loader className="min-h-48 w-full max-w-sm bg-transparent" showLabel />
    </Container>
  );
}
