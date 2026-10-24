import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResultBadge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import { Container } from "./container";
import { TextField } from "./field";
import { Skeleton } from "./skeleton";
import { TBody, TD, TH, THead, TR, Table } from "./table";

describe("Button", () => {
  it("is a non-submitting button by default and fires clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Сохранить</Button>);
    const button = screen.getByRole("button", { name: "Сохранить" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Нельзя
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(["primary", "secondary", "text"] as const)("renders the %s variant", (variant) => {
    render(<Button variant={variant}>Кнопка</Button>);
    expect(screen.getByRole("button")).toHaveClass("min-h-11");
  });
});

describe("TextField", () => {
  it("links the label to the input", () => {
    render(<TextField id="nick" label="Ник" />);
    expect(screen.getByLabelText("Ник")).toHaveAttribute("id", "nick");
  });

  it("marks the input invalid and announces the error", () => {
    render(<TextField id="email" label="Email" error="Неверный email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Неверный email");
    expect(screen.getByRole("alert")).toHaveTextContent("Неверный email");
  });

  it("describes the input with its hint", () => {
    render(<TextField id="n" label="Ник" hint="3–20 символов" />);
    expect(screen.getByLabelText("Ник")).toHaveAccessibleDescription("3–20 символов");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Card", () => {
  it("renders a title as a heading", () => {
    render(<Card title="Тур 1">Содержимое</Card>);
    expect(screen.getByRole("heading", { name: "Тур 1" })).toBeInTheDocument();
    expect(screen.getByText("Содержимое")).toBeInTheDocument();
  });

  it("uses the dark background for the accent variant", () => {
    render(<Card variant="accent" title="Пост" data-testid="card" />);
    expect(screen.getByTestId("card")).toHaveClass("bg-ink");
    expect(screen.getByRole("heading", { name: "Пост" })).toHaveClass("text-accent");
  });
});

describe("ResultBadge", () => {
  it.each([
    ["exact", "Точный счёт"],
    ["outcome", "Исход"],
    ["miss", "Мимо"],
  ] as const)("shows text for %s", (result, text) => {
    render(<ResultBadge result={result} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});

describe("Table", () => {
  it("renders headers, cells and a highlighted row", () => {
    render(
      <Table caption="Легенда">
        <THead>
          <TR>
            <TH>Участник</TH>
          </TR>
        </THead>
        <TBody>
          <TR highlight>
            <TD>Readberg</TD>
          </TR>
        </TBody>
      </Table>,
    );
    expect(screen.getByRole("table", { name: "Легенда" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Участник" })).toHaveAttribute("scope", "col");
    expect(screen.getByRole("row", { name: "Readberg" })).toHaveClass("bg-accent!");
  });
});

describe("Container and Skeleton", () => {
  it("limits the width", () => {
    render(<Container data-testid="c" />);
    expect(screen.getByTestId("c")).toHaveClass("max-w-site");
  });

  it("announces loading", () => {
    render(<Skeleton />);
    expect(screen.getByRole("status", { name: "Загрузка…" })).toBeInTheDocument();
  });
});
