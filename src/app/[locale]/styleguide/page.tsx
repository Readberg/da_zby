import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ResultBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SelectField, TextField, TextareaField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { initLocale } from "@/i18n/server";

// Internal design showcase (docs/design). Dev-only, so its sample texts live here, not in ru.ts.
export const metadata: Metadata = { title: "Стайлгайд", robots: { index: false } };

const palette = [
  ["bg", "bg-bg"],
  ["ink", "bg-ink"],
  ["accent", "bg-accent"],
  ["muted", "bg-muted"],
  ["line", "bg-line"],
  ["surface", "bg-surface"],
  ["success", "bg-success"],
  ["danger", "bg-danger"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} data-snap={id} className="flex flex-col gap-4 border-t border-line py-8">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

export default async function StyleguidePage(props: PageProps<"/[locale]/styleguide">) {
  await initLocale(props.params);
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Container className="py-8">
      <h1 className="text-h3 sm:text-h1">Стайлгайд</h1>
      <p className="mt-2 text-muted">
        Витрина компонентов из <code>src/components/ui</code>. Каталог —{" "}
        <code>docs/design/COMPONENTS.md</code>.
      </p>

      <Section id="tokens-palette" title="Цвета">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {palette.map(([name, className]) => (
            <li key={name} className="flex items-center gap-3">
              <span className={`h-11 w-11 shrink-0 rounded-md border border-line ${className}`} />
              <code className="text-sm">--color-{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="tokens-type" title="Типографика">
        <p className="font-display text-h1 uppercase">Заголовок h1 56</p>
        <p className="font-display text-h2 uppercase">Заголовок h2 40</p>
        <p className="font-display text-h3 uppercase">Заголовок h3 28</p>
        <p className="text-lg">Текст 20 — Барановичи, «Да забей», ЁЖЗ ёжз 0123456789</p>
        <p className="text-base">Основной текст 16 — Съешь же ещё этих мягких французских булок.</p>
        <p className="text-sm text-muted">Вторичный текст 14</p>
      </Section>

      <Section id="button" title="Кнопки">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Основная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="text">Текстовая</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Основная</Button>
          <Button variant="secondary" disabled>
            Вторичная
          </Button>
          <Button variant="text" disabled>
            Текстовая
          </Button>
        </div>
        <p className="text-sm text-muted">
          Вторая строка — disabled. Hover — наведите курсор; focus — Tab.
        </p>
      </Section>

      <Section id="field" title="Поля ввода">
        <div className="grid max-w-md gap-4">
          <TextField id="sg-nick" label="Ник" placeholder="Readberg" hint="3–20 символов" />
          <TextField
            id="sg-email"
            label="Email"
            type="email"
            defaultValue="not-an-email"
            error="Введите корректный email"
          />
          <TextField id="sg-disabled" label="Недоступно" defaultValue="Нельзя менять" disabled />
          <TextareaField
            id="sg-about"
            label="О себе"
            hint="0/1000"
            defaultValue="Люблю белорусский футбол"
          />
          <SelectField id="sg-country" label="Страна" defaultValue="BY">
            <option value="">Не выбрана</option>
            <option value="BY">Беларусь</option>
            <option value="PL">Польша</option>
          </SelectField>
        </div>
      </Section>

      <Section id="avatar" title="Аватар">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name="Readberg" size="sm" />
          <Avatar name="Баранки" size="md" />
          <Avatar name="Prognozist" size="lg" />
        </div>
      </Section>

      <Section id="card" title="Карточки">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Обычная">Светлый фон, тонкая рамка.</Card>
          <Card variant="accent" title="Акцентная">
            Чёрный фон и жёлтый заголовок, как в постах канала.
          </Card>
        </div>
      </Section>

      <Section id="badge" title="Бейджи результата">
        <div className="flex flex-wrap gap-2">
          <ResultBadge result="exact" />
          <ResultBadge result="outcome" />
          <ResultBadge result="miss" />
        </div>
      </Section>

      <Section id="table" title="Таблица">
        <Table caption="О — очки, ТС — точные счета, И — исходы">
          <THead>
            <TR>
              <TH>#</TH>
              <TH>Участник</TH>
              <TH className="text-right">О</TH>
              <TH className="text-right">ТС</TH>
              <TH className="text-right">И</TH>
            </TR>
          </THead>
          <TBody>
            <TR highlight>
              <TD>1</TD>
              <TD>Readberg</TD>
              <TD className="text-right">21</TD>
              <TD className="text-right">5</TD>
              <TD className="text-right">6</TD>
            </TR>
            <TR>
              <TD>2</TD>
              <TD>Prognozist_007</TD>
              <TD className="text-right">17</TD>
              <TD className="text-right">3</TD>
              <TD className="text-right">8</TD>
            </TR>
            <TR>
              <TD>3</TD>
              <TD>Баранки</TD>
              <TD className="text-right">12</TD>
              <TD className="text-right">2</TD>
              <TD className="text-right">6</TD>
            </TR>
          </TBody>
        </Table>
      </Section>

      <Section id="skeleton" title="Скелетоны">
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      </Section>

      <Section id="container" title="Контейнер">
        <p>
          Эта страница обёрнута в <code>Container</code>: отступ 16 px на телефоне, максимум 1200
          px.
        </p>
      </Section>
    </Container>
  );
}
