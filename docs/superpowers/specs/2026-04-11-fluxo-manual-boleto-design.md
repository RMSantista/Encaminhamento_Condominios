# Design: Fluxo Manual de Repasse de Boleto

**Data:** 2026-04-11
**Status:** Aprovado

---

## Contexto

Quando a Premier Garantidora não envia o boleto por e-mail, o usuário o recebe via
WhatsApp, salva o PDF em uma pasta local sincronizada com o Google Drive (via Google
Drive for Desktop) e precisa que a automação detecte, envie e remova esse arquivo
automaticamente — sem intervenção adicional.

---

## Objetivo

Implementar `verificarPastaManual()` em `src/manual.js`: função que monitora uma pasta
do Google Drive nos dias 10 a 13 de cada mês (às 8h, 12h e 16h), envia o PDF encontrado
para a imobiliária e move o arquivo para a lixeira. Compartilha o mesmo controle de
idempotência de `repassarBoleto()` via Gmail label.

---

## Arquitetura

```
verificarPastaManual()          [src/manual.js]
│
├── Guard: contrato expirado?              → return (log)
├── Guard: dia fora de [10, 11, 12, 13]?  → return (log)
├── Guard: label do mês já existe?        → return (log)
├── Buscar PDFs na pasta do Drive         [DriveApp]
│       └── pasta vazia?                 → return (log)
├── Pegar primeiro PDF encontrado
│       └── mais de 1 PDF?               → log de aviso (processa apenas o primeiro)
├── Montar corpo do e-mail                [montarEmailRepasse() — repasse.js]
├── Enviar e-mail com PDF como anexo      [GmailApp]
├── Criar label de idempotência           [GmailApp.createLabel()]  ← label flutuante (sem thread)
└── Mover PDF para a lixeira              [arquivo.setTrashed(true)]
```

---

## Idempotência compartilhada

`verificarPastaManual()` cria o label `Condominio/Repassado-YYYY-MM` — o mesmo
verificado por `repassarBoleto()`. Isso garante:

- Se a Premier enviar o e-mail após repasse manual → `repassarBoleto()` encontra o
  label e para.
- Se `repassarBoleto()` já processou o e-mail da Premier → `verificarPastaManual()`
  encontra o label e para.
- Nunca haverá envio duplicado entre os dois fluxos.

O label é month-scoped (`YYYY-MM`), portanto se reinicia automaticamente a cada mês.

**Label flutuante (sem thread):** No fluxo manual não há thread do Gmail para associar
o label — o PDF vem do Drive, não de um e-mail recebido. O label é criado como marcador
de controle sem mensagem vinculada. Isso é intencional e funcionalmente correto:
`GmailApp.getUserLabelByName()` detecta o label independentemente de estar associado a
uma thread. A ausência de mensagens vinculadas ao label em determinado mês indica que o
repasse foi feito pelo fluxo manual (não pelo e-mail da Premier).

---

## Alterações por arquivo

### `src/config.js`

Duas constantes novas:

```javascript
// ── Fluxo manual (boleto via WhatsApp → pasta Drive) ────────────
// ID obtido da URL ao abrir a pasta no Drive: drive.google.com/drive/folders/{ID}
const PASTA_MANUAL_ID         = '1-LITJk2RHnlXPwrMy_XwhsLFzTZjqVRu';
const DIAS_VERIFICACAO_MANUAL = [10, 11, 12, 13];
```

### `src/manual.js` (novo)

```javascript
function verificarPastaManual() {
  if (new Date() > new Date(CONTRATO_FIM)) {
    Logger.log('Contrato encerrado. verificarPastaManual() abortado.');
    return;
  }

  const hoje   = new Date();
  const dia    = Number(Utilities.formatDate(hoje, TIMEZONE, 'd'));
  const mesRef = Utilities.formatDate(hoje, TIMEZONE, 'yyyy-MM');

  if (!DIAS_VERIFICACAO_MANUAL.includes(dia)) {
    Logger.log(`Dia ${dia}: fora do período de verificação manual. Nenhuma ação.`);
    return;
  }

  const labelNome = `${LABEL_BASE}-${mesRef}`;
  if (GmailApp.getUserLabelByName(labelNome)) {
    Logger.log(`Boleto de ${mesRef} já repassado. verificarPastaManual() encerrado.`);
    return;
  }

  const pasta    = DriveApp.getFolderById(PASTA_MANUAL_ID);
  const arquivos = pasta.getFilesByType(MimeType.PDF);

  if (!arquivos.hasNext()) {
    Logger.log(`Pasta manual vazia em ${mesRef} dia ${dia}. Aguardando PDF.`);
    return;
  }

  const arquivo = arquivos.next();

  // Aviso se houver mais de 1 PDF — apenas o primeiro será processado este mês
  if (arquivos.hasNext()) {
    Logger.log(`AVISO: mais de 1 PDF encontrado na pasta. Apenas "${arquivo.getName()}" será processado. Remova os demais manualmente.`);
  }

  const pdfBlob = arquivo.getBlob().setName(arquivo.getName());
  const { assunto, corpo } = montarEmailRepasse(mesRef);

  if (DRY_RUN) {
    Logger.log(`[DRY_RUN] Enviaria "${arquivo.getName()}" para ${DESTINO_IMOBILIARIA}`);
  } else {
    GmailApp.sendEmail(DESTINO_IMOBILIARIA, assunto, corpo, {
      attachments: [pdfBlob],
      name: 'Automação Condomínio'
    });
    Logger.log(`PDF manual "${arquivo.getName()}" repassado para ${DESTINO_IMOBILIARIA}`);

    // Label flutuante (sem thread) — funciona como marcador de controle mensal
    GmailApp.createLabel(labelNome);

    arquivo.setTrashed(true);
    Logger.log(`"${arquivo.getName()}" movido para a lixeira.`);
  }
}
```

### `src/appsscript.json`

Adicionar scope do Drive:

```json
"https://www.googleapis.com/auth/drive"
```

**Nota sobre escopo:** `https://www.googleapis.com/auth/drive` concede acesso completo
de leitura/escrita ao Drive. O GAS não oferece um escopo mais restrito que cubra
`DriveApp.getFolderById()` combinado com `file.setTrashed(true)` em arquivos arbitrários
do usuário. O escopo é portanto o mínimo tecnicamente possível para esta operação.

### `src/repasse.js` — `installTriggers()` completo atualizado

`installTriggers()` apaga todos os triggers existentes antes de recriar. O corpo
completo após a adição dos 3 novos triggers (total: 5):

```javascript
function installTriggers() {
  // Remove todos os triggers existentes para evitar duplicatas
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // T1 — repasse diário (6h–7h)
  ScriptApp.newTrigger('repassarBoleto')
    .timeBased().everyDays(1).atHour(6).create();

  // T2 — alerta de pendência diário (8h–9h)
  ScriptApp.newTrigger('verificarPendencia')
    .timeBased().everyDays(1).atHour(8).create();

  // T3/T4/T5 — verificação da pasta manual (dias 10-13, 8h / 12h / 16h)
  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(8).create();

  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(12).create();

  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(16).create();

  Logger.log('Triggers instalados com sucesso.');
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(`  - ${t.getHandlerFunction()} (${t.getTriggerSource()})`);
  });
}
```

Total de triggers: 5 (limite do GAS: 20).

---

## Tratamento de erros

- **Pasta não encontrada** → GAS lança exceção nativa; o trigger registra o erro em
  Execuções e tenta novamente no próximo horário agendado.
- **Múltiplos PDFs na pasta** → apenas o primeiro é processado; os demais permanecem
  na pasta indefinidamente (idempotência impede reenvio após o primeiro envio no mês).
  Um `Logger.log` de aviso orienta o usuário a remover os arquivos extras manualmente.
- **Falha no envio do e-mail** → label não é criado, arquivo não vai para a lixeira;
  próxima execução agendada tentará novamente.

---

## Verificação e testes

**Restrição de data:** `verificarPastaManual()` só age nos dias 10–13. Para testar fora
desse período, altere temporariamente `DIAS_VERIFICACAO_MANUAL` para incluir o dia atual
(ex: `[1, 2, ..., 31]`) e restaure após o teste.

1. Setar `DRY_RUN = true` em `config.js`
2. Colocar um PDF de teste na pasta Drive sincronizada
3. Garantir que o dia atual está em `DIAS_VERIFICACAO_MANUAL` (ajustar se necessário)
4. Executar `verificarPastaManual()` manualmente no editor do GAS
5. Verificar log: `[DRY_RUN] Enviaria "nome.pdf" para administrativo@piramidimoveis.com.br`
6. Confirmar que o arquivo **não** foi para a lixeira (DRY_RUN não deleta)
7. Setar `DRY_RUN = false`, executar novamente
8. Verificar: e-mail chegou, arquivo na lixeira, label `Condominio/Repassado-YYYY-MM` criado
9. Executar uma terceira vez → log: `Boleto de YYYY-MM já repassado. verificarPastaManual() encerrado.`
10. Executar `installTriggers()` para ativar os 5 triggers
