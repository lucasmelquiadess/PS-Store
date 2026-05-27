# PS Store - DualSense Edge

Landing page conceitual para o **Controle sem fio DualSense Edge®**, criada para estudo de front-end, back-end, UI/UX e animações de apresentação de produto.

Inicialmente focado no front para apresentação de um produto, evolui o projeto para um e-commerce simulado completo! Carrinho, pagamento, finalização e gestão de cadastros.

O projeto usa TypeScript, React, Vite, CSS responsivo, GSAP para animações de scroll e Three.js para uma cena WebGL full-bleed no hero.

## Como rodar

```bash
npm install
npm run dev
```

Depois acesse o endereço exibido pelo Vite, normalmente `http://127.0.0.1:5173/`.

Para usar login, cadastro, carrinho, CEP, checkout e pedidos, rode a API em outro terminal:

```bash
npm run dev:api
```

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

Para rodar a verificação automatizada de front, API, SQLite, autenticação, checkout e exclusão segura de conta:

```bash
npm test
```

O teste usa um banco temporário em `.data/`, com CEP em modo local, sem alterar cadastros reais.

## Estrutura

```text
src/
  App.tsx                 # composição da landing page
  data/product.ts         # textos, links e assets oficiais remotos
  hooks/useThreeStage.ts  # cena WebGL em Three.js
  styles.css              # design system, responsividade e layout
server/
  index.ts                # API HTTP, validações e rotas protegidas
  authDb.ts               # SQLite, sessões e persistência da conta
scripts/
  smoke-test.mjs          # teste de integração em banco temporário
docs/
  figma-redesign-guide.md # guia para recriar o layout no Figma
```

## Segurança

- Senhas armazenadas com hash `scrypt` e salt individual.
- Sessões em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Validação server-side para e-mail, CPF, CEP, celular, UF, senha e checkout.
- Rate limit em login, cadastro, recuperação, frete e checkout.
- Proteção de origem para mutações, CORS restrito e headers de segurança.
- SQLite com `secure_delete`, foreign keys e `.data/` fora do versionamento.
- Exclusão de conta anonimiza dados pessoais e preserva pedidos já concluídos.
- Arquivos locais sensíveis (`.data/`, `.env`, logs e builds) ficam fora do Git.


## Em evolução | Próximos passos

- Criar uma seção de comparação entre o DualSense e o DualSense Edge.
- Adicionar um modo "Midnight Black" que troca tema, imagens e tokens.
- Evoluir o checkout simulado com novos estados de pedido e seleção de acessórios, além de buscar novos produtos.
- Refinar a cena Three.js com um modelo 3D real

## Observações

Este é um projeto independente para fins de estudo. PlayStation, DualSense Edge e imagens de produto pertencem aos seus respectivos donos. As imagens são referenciadas remotamente a partir de assets públicos oficiais da PlayStation.
