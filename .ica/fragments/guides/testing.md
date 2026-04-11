---
id: testing
type: guide
title: "Como testar o projeto"
status: active
tags: [testes, dry-run, validação, logs, qualidade, checklist]
depends_on: [config-spec, repasse-spec, alerta-spec]
---

## Filosofia de testes no GAS

GAS não tem framework de testes nativo. A estratégia é:
1. **DRY_RUN** — executa tudo sem efeito colateral real
2. **Funções de teste isoladas** — testam partes específicas com dados fixos
3. **Logger.log** — toda execução com efeito deve logar; logs são o assert

## DRY_RUN mode

Em `src/config.js`, defina `DRY_RUN = true`.

Com DRY_RUN ativo:
- `repassarBoleto()` processa tudo mas **não envia o e-mail** e **não aplica o label**
- `verificarPendencia()` avalia a condição mas **não envia o alerta**
- Todos os valores que seriam usados aparecem nos logs

```javascript
if (DRY_RUN) {
  Logger.log(`[DRY_RUN] Enviaria para: ${DESTINO_IMOBILIARIA}`);
  Logger.log(`[DRY_RUN] Assunto: ${assunto}`);
  Logger.log(`[DRY_RUN] Corpo:\n${corpo}`);
  Logger.log(`[DRY_RUN] PDF Blob: ${pdfBlob.getName()} (${pdfBlob.getBytes().length} bytes)`);
}
```

## Funções de teste unitário

Adicione em `src/repasse.js` (remova antes do deploy final ou mantenha — não têm trigger):

```javascript
function testExtrairLink() {
  // HTML simulado com estrutura do e-mail da Premier
  const htmlFake = `<html><body>
    <a href="https://boletos.premiergarantidora.com.br/boleto/12345.pdf"
       style="...">Visualizar Boleto</a>
  </body></html>`;

  const link = extrairLinkBoleto(htmlFake);
  Logger.log(`Link extraído: ${link}`);
  Logger.log(link ? '✅ PASSOU' : '❌ FALHOU — regex não encontrou o link');
}

function testMontarCorpo() {
  const { assunto, corpo } = montarEmailRepasse('2026-04');
  Logger.log(`Assunto: ${assunto}`);
  Logger.log(`Corpo:\n${corpo}`);
  // Verificar visualmente se as competências estão corretas
}

function testMontarCorpoDezembroParaJaneiro() {
  const { assunto, corpo } = montarEmailRepasse('2026-12');
  Logger.log(`Corpo dezembro→janeiro:\n${corpo}`);
  // Deve mostrar "competência de Dezembro/2026 ... aluguel de Janeiro/2027"
}

function testVerificarPendencia_semLabel() {
  // Garante que DRY_RUN está true antes de rodar
  Logger.log('DRY_RUN está: ' + DRY_RUN);
  verificarPendencia();
}
```

## Checklist de validação pré-deploy

Execute cada item e verifique os logs:

- [ ] `testExtrairLink()` — link capturado corretamente
- [ ] `testMontarCorpo()` — assunto e competências corretos para o mês atual
- [ ] `testMontarCorpoDezembroParaJaneiro()` — virada de ano correta
- [ ] `repassarBoleto()` com `DRY_RUN = true` — logs mostram PDF, assunto e corpo
- [ ] `verificarPendencia()` com `DRY_RUN = true` e sem label do mês — log de alerta
- [ ] `verificarPendencia()` com `DRY_RUN = true` e com label do mês — "repasse confirmado"
- [ ] `repassarBoleto()` com `DRY_RUN = false` — e-mail chega em `administrativo@piramidimoveis.com.br`
- [ ] Verificar se label `Condominio/Repassado-YYYY-MM` foi criado no Gmail
- [ ] Rodar `repassarBoleto()` segunda vez — deve abortar por idempotência

## Ver logs no terminal

```bash
clasp logs              # últimas execuções
clasp logs --watch      # modo streaming (ctrl+C para parar)
```

## Simular dia 10 sem boleto

1. Certifique que não existe label `Condominio/Repassado-{MÊS_ATUAL}` no Gmail
2. Temporariamente altere `DIAS_VERIFICACAO = [dia_de_hoje]` em config.js
3. Execute `verificarPendencia()` manualmente
4. Verifique se o alerta chegou no seu e-mail
5. Reverta `DIAS_VERIFICACAO` para `[8, 9, 10]`
