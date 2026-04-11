---
id: email-spec
type: specification
title: "Especificação do e-mail de repasse"
status: active
tags: [email, assunto, corpo, competencia, imobiliaria, mariana]
depends_on: [config-spec]
---

## Dados fixos do e-mail

| Campo | Valor |
|---|---|
| Para | `administrativo@piramidimoveis.com.br` |
| Assunto | `Ajuste de Condomínio` |
| Anexo | PDF do boleto (Blob baixado da Premier) |
| Nome do remetente | `Automação Condomínio` |

## Corpo do e-mail

O corpo varia dinamicamente com as competências (mês do condomínio e mês do aluguel):

```
A/C Mariana - Setor de Proprietários.

Segue boleto de condomínio com valor correto, referente à competência de {MÊS_COND}/{ANO_COND}, para ser lançado no aluguel de {MÊS_ALU}/{ANO_ALU}.

Atenciosamente.
```

## Regra de competência

**Condomínio do mês X é lançado no aluguel do mês X+1.**

Exemplos:
- Boleto recebido em abril/2026 → "competência de Abril/2026 ... aluguel de Maio/2026"
- Boleto recebido em dezembro/2026 → "competência de Dezembro/2026 ... aluguel de Janeiro/2027"

A virada de ano (dezembro → janeiro) deve ser tratada explicitamente no código.

## Assinatura

O GAS não inclui assinatura HTML automaticamente no `sendEmail()`. O corpo
termina com "Atenciosamente." sem assinatura formatada — simples e correto
para e-mail funcional entre sistemas.

## Exemplo real do e-mail gerado (abril/2026)

```
Para: administrativo@piramidimoveis.com.br
Assunto: Ajuste de Condomínio
Anexo: boleto_condominio_abril_2026.pdf

A/C Mariana - Setor de Proprietários.

Segue boleto de condomínio com valor correto, referente à competência de Abril/2026, para ser lançado no aluguel de Maio/2026.

Atenciosamente.
```
