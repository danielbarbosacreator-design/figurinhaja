import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Contato / Suporte" };

export default function ContatoPage() {
  return (
    <LegalPage title="Contato / Suporte">
      <p>
        Precisa de ajuda com um pagamento, um download ou quer excluir suas
        fotos? Fale com a gente.
      </p>
      <h2>E-mail</h2>
      <p>
        <a
          className="text-primary-strong underline underline-offset-4"
          href="mailto:suporte@exemplo.com.br"
        >
          suporte@exemplo.com.br
        </a>
      </p>
      <h2>Horário de atendimento</h2>
      <p>Segunda a sexta, das 9h às 18h. Respondemos em até 1 dia útil.</p>
      <h2>Ao entrar em contato, tenha em mãos</h2>
      <p>
        O e-mail ou telefone usado no pagamento e a data aproximada da compra.
        Isso agiliza a localização do seu pedido.
      </p>
    </LegalPage>
  );
}
