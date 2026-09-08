"use client";

import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "success" | "info";
type Size = "lg" | "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-6 font-semibold tracking-tight transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed select-none active:scale-[0.98]";

const sizes: Record<Size, string> = {
  lg: "min-h-14 py-4 w-full text-lg font-bold",
  md: "min-h-12 py-3 text-base",
  sm: "min-h-10 py-2 px-4 text-sm",
};

const variants: Record<Variant, string> = {
  // Ação principal — amarelo com texto navy. Uma por tela.
  primary:
    "bg-accent text-accent-ink hover:bg-accent-dark active:bg-accent-dark shadow-[0_6px_20px_-4px_rgba(251,191,36,0.55)]",
  secondary:
    "bg-surface text-foreground border-2 border-border hover:border-primary/40 active:bg-background shadow-sm",
  ghost: "bg-transparent text-muted hover:text-foreground hover:bg-surface",
  // Identidade / caminho principal em roxo, quando não for o CTA de conversão.
  success:
    "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark shadow-md",
  info:
    "bg-primary text-white hover:bg-primary-dark active:bg-primary-dark shadow-md",
};

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: undefined;
  };

type LinkProps = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps | "href"> & {
    href: string;
  };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "primary", size = "lg", className = "", ...rest } = props;
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;

  if (typeof props.href === "string") {
    const { href, ...anchorRest } = rest as LinkProps;
    return <Link href={href} role="button" className={cls} {...anchorRest} />;
  }

  const { href: _omit, ...buttonRest } = rest as ButtonProps;
  void _omit;
  return <button className={cls} {...buttonRest} />;
}
