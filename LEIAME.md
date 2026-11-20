# App de campo — piloto PWA

App que abre no celular, funciona sem sinal e envia os registros para uma planilha Google sua quando o sinal volta.
Os dados vão só para a SUA conta Google. Nenhum serviço de terceiros recebe nada.

## Passo 1 — Planilha que recebe os dados (10 min)
1. Crie uma planilha Google nova e vazia (ex.: "Piloto obra - registros").
2. Menu **Extensões > Apps Script**. Apague o que estiver lá e cole o conteúdo de `Code.gs`.
3. Troque `troque-esta-senha` por uma senha sua (qualquer texto, sem espaços).
4. **Implantar > Nova implantação > Tipo: App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Autorize quando pedir (ele vai pedir acesso à planilha e ao Drive: é para gravar os registros e as fotos).
6. Copie o endereço que termina em `/exec`.

## Passo 2 — Configurar o app
Abra `config.js` e preencha:
- `OBRA`: nome da obra
- `ENDPOINT`: o endereço `/exec` do passo 1
- `TOKEN`: a mesma senha do passo 1
- `ETAPAS` e `TIPOS`: ajuste os serviços da obra, se quiser

## Passo 3 — Colocar no ar (precisa ser endereço https)
Opção mais simples: **Netlify Drop** (app.netlify.com/drop). Arraste esta pasta inteira e ele gera um endereço.
Outras: GitHub Pages, Cloudflare Pages.
Não abra o arquivo direto do computador: o modo offline só funciona pelo endereço https.

## Passo 4 — Instalar no celular (Android, Chrome)
Abra o endereço > menu do Chrome (3 pontinhos) > **Instalar app** / **Adicionar à tela inicial**.
Abra o app **uma vez com internet** para ele guardar tudo para uso offline.

## Passo 5 — Teste antes de levar à obra
1. Com internet, abra o app e digite o nome.
2. Ligue o **modo avião**.
3. Registre um avanço e um gasto, com foto.
4. Desligue o modo avião. Em até 30 segundos o aviso "para enviar" some e os registros aparecem na planilha.

## Limites deste piloto (para saber antes de mostrar)
- Segurança básica: a senha fica visível a quem sabe olhar o código. Serve para piloto com gente de confiança, não para produto final.
- Cada pessoa digita o nome uma vez. Não há login.
- Não há painel: a própria planilha é o painel (use gráficos e tabelas dinâmicas dela).
- Para atualizar o app depois de mudar arquivos, aumente o `V = 'obra-v1'` em `sw.js` (para `obra-v2` etc.).
- No iPhone o PWA funciona, mas o suporte é mais limitado. Teste com Android primeiro.
- Não use dados reais da Moinho, da Koper ou de terceiros sem autorização.
