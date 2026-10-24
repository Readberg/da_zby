import { Container } from "@/components/ui/container";
import { ru } from "@/messages/ru";

export default function Home() {
  return (
    <Container className="flex flex-1 flex-col justify-center py-8">
      <h1 className="text-h3 sm:text-h1">{ru.site.name}</h1>
      <p className="mt-2 text-muted">{ru.site.tagline}</p>
    </Container>
  );
}
