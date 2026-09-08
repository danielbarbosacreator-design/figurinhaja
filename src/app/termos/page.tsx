import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso">
      <p>
        Ao usar este serviço você concorda com as regras abaixo. Se não
        concordar, não utilize o produto.
      </p>
      <h2>O que oferecemos</h2>
      <p>
        Uma ferramenta que cria figurinhas e imagens personalizadas a partir das
        fotos que você envia, usando geração de imagens por inteligência
        artificial. O resultado é uma criação artística e pode conter imprecisões.
      </p>
      <h2>Uso das imagens geradas</h2>
      <p>
        Imagens que combinam pessoas diferentes (por exemplo, você ao lado de um
        político) são montagens ilustrativas criadas por IA e não representam um
        acontecimento real. Não use o material para enganar terceiros, atribuir
        falas ou atos que não ocorreram, nem para qualquer finalidade ilícita,
        difamatória ou de discurso de ódio.
      </p>
      <h2>Responsabilidade sobre as fotos enviadas</h2>
      <p>
        Você declara ter o direito de usar as fotos que enviar. Não envie fotos
        de terceiros sem autorização, nem imagens de crianças e adolescentes.
      </p>
      <h2>Pagamento e entrega</h2>
      <p>
        O valor é informado antes da compra. Os arquivos em alta qualidade são
        liberados automaticamente após a confirmação do pagamento pelo provedor.
      </p>
      <h2>Reembolso</h2>
      <p>
        Se o resultado não for entregue por falha nossa, o valor é devolvido.
        Entre em contato pelo suporte.
      </p>
      <h2>Alterações</h2>
      <p>Estes termos podem ser atualizados. A versão vigente fica sempre nesta página.</p>
    </LegalPage>
  );
}
