# Guia Figma do Redesign

Use este guia para recriar a landing page no Figma antes de codar novas variações.

## Frames

- Desktop: `1440 x 1200`
- Laptop: `1280 x 900`
- Tablet: `768 x 1024`
- Mobile: `390 x 844`

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| Ink | `#05070D` | fundo principal escuro |
| Ink Soft | `#0C1018` | cards escuros |
| Paper | `#F5F7FB` | seções claras |
| PlayStation Blue | `#0072CE` | ações e marcação |
| Cyan | `#54DDFF` | detalhes técnicos |
| Lime | `#B7FF68` | confirmação e destaque |
| Magenta | `#FF4F9B` | contraste visual |
| Orange | `#FF9D3D` | numeração e pontos de atenção |
| Radius | `8px` | cards, painéis e imagens |

## Tipografia

- Família: Inter ou SF Pro como substituta.
- Hero desktop: `96px / 0.96`, peso `900`.
- Títulos de seção: `68px / 0.96`, peso `900`.
- Corpo: `18px / 1.55`.
- Eyebrow: `14px`, peso `800`, uppercase.

## Componentes

1. Nav compacta
   - Altura: `72px`
   - Largura: `1120px`
   - Fundo: `#05070D` com opacidade entre `72%` e `80%`
   - Blur: `18px`

2. Hero de produto
   - Grade desktop: `0.92fr / 1.08fr`
   - Camadas: background oficial, cena técnica, copy, produto, stats.
   - A imagem do controle deve ocupar a primeira dobra como sinal principal.

3. Cards de destaque
   - Grid desktop: 4 colunas.
   - Raio: `8px`.
   - Ícone acima, eyebrow no meio, título e texto no fim.

4. Story sticky
   - Produto fixo à esquerda.
   - Cards de texto à direita.
   - Estado ativo com borda cyan e fundo azul translúcido.

5. Bancada de perfis
   - Segmented control com 4 opções.
   - Painel com descrição e três barras de métrica.

## Timeline de animação

- Hero copy: entrada com `y: 36`, opacity `0 -> 1`, stagger curto.
- Produto no hero: entrada com `scale: 0.94 -> 1`.
- Scroll hero: produto desce, reduz escala e inclina levemente.
- Story: cada card ativo altera rotação e escala do produto.
- Feature rail: em desktop, scroll vertical move cards na horizontal.
- Imagem de detalhe: parallax vertical suave.

## Checklist de UX

- O nome do produto aparece na primeira dobra.
- O produto e sua textura são visíveis antes de qualquer explicação longa.
- Nenhum bloco depende apenas de cor para comunicar estado.
- CTAs têm texto claro e área de toque confortável.
- Em mobile, o carrossel horizontal vira scroll com snap.
- `prefers-reduced-motion` desativa transições longas.
