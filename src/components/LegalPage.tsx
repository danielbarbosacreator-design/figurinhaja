import Link from "next/link";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 py-8">
      <Link
        href="/"
        className="text-muted font-semibold text-base flex items-center gap-1"
      >
        <span aria-hidden>←</span> Início
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-foreground/90 [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mt-6">
        {children}
      </div>
      <p className="mt-8 text-xs text-muted">
        Rascunho para revisão jurídica antes do lançamento. Última atualização:
        setembro de 2025.
      </p>
    </main>
  );
}
