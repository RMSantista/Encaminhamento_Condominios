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
├── Montar corpo do e-mail                [montarEmailRepasse() — repasse.js]
├── Enviar e-mail com PDF como anexo      [GmailApp]
├── Criar label de idempotência           [GmailApp.createLabel()]
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

---

## Alterações por arquivo

### `src/config.js`

Duas constantes novas:

```javascript
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

### `src/repasse.js` — `installTriggers()`

Adicionar 3 triggers para `verificarPastaManual`:

```javascript
ScriptApp.newTrigger('verificarPastaManual')
  .timeBased().everyDays(1).atHour(8).create();

ScriptApp.newTrigger('verificarPastaManual')
  .timeBased().everyDays(1).atHour(12).create();

ScriptApp.newTrigger('verificarPastaManual')
  .timeBased().everyDays(1).atHour(16).create();
```

Total de triggers após instalação: 5 (limite do GAS: 20).

---

## Tratamento de erros

- Pasta não encontrada → GAS lança exceção nativa (Drive inválido); o trigger registra
  o erro em Execuções e tenta novamente no próximo horário.
- Múltiplos PDFs na pasta → apenas o primeiro é processado; os demais ficam para a
  próxima verificação (idempotência impede reenvio do mesmo mês).
- Falha no envio do e-mail → label não é criado, arquivo não é movido para a lixeira;
  próxima execução tentará novamente.

---

## Verificação e testes

1. Setar `DRY_RUN = true` em `config.js`
2. Colocar um PDF de teste na pasta Drive sincronizada
3. Executar `verificarPastaManual()` manualmente no editor do GAS no dia 10–13
4. Verificar log: `[DRY_RUN] Enviaria "nome.pdf" para administrativo@piramidimoveis.com.br`
5. Confirmar que o arquivo **não** foi para a lixeira (DRY_RUN não deve deletar)
6. Setar `DRY_RUN = false`, executar novamente
7. Verificar: e-mail chegou, arquivo na lixeira, label `Condominio/Repassado-YYYY-MM` criado
8. Executar uma terceira vez → log de idempotência: `Boleto já repassado`
