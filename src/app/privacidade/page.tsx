import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade">
      <p>
        Explicamos aqui, de forma direta, o que fazemos com as suas fotos e
        dados. Tratamento conforme a LGPD (Lei nº 13.709/2018).
      </p>
      <h2>Quais dados coletamos</h2>
      <p>
        As fotos que você envia; dados técnicos básicos de navegação (para
        segurança e métricas); e os dados de pagamento processados pelo gateway
        (não recebemos nem armazenamos número de cartão).
      </p>
      <h2>Para que usamos</h2>
      <p>
        Suas fotos são usadas exclusivamente para criar o seu resultado. Não
        vendemos suas fotos e não as usamos para treinar modelos.
      </p>
      <h2>Por quanto tempo guardamos</h2>
      <p>
        As fotos enviadas e os resultados gerados são apagados automaticamente
        após um período curto (por padrão, 30 dias). Você pode pedir a exclusão
        imediata pelo suporte.
      </p>
      <h2>Compartilhamento</h2>
      <p>
        Compartilhamos dados apenas com os provedores necessários para o serviço
        funcionar: geração de imagens, armazenamento, pagamento e métricas. Cada
        um trata os dados apenas para essa finalidade.
      </p>
      <h2>Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção ou exclusão dos seus dados a
        qualquer momento pelo canal de contato.
      </p>
    </LegalPage>
  );
}
