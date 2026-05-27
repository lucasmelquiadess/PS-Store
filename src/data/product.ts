export const officialLinks = {
  playstation:
    "https://www.playstation.com/pt-br/accessories/dualsense-edge-wireless-controller/",
  buy:
    "https://direct.playstation.com/pt-br/buy-accessories/dualsense-edge-wireless-controller",
};

export const productAssets = {
  heroProduct:
    "https://gmedia.playstation.com/is/image/SIEPDC/DualSense-Edge-image-block-02-en-24aug22?$1600px--t$",
  heroBackdrop:
    "https://gmedia.playstation.com/is/image/SIEPDC/dualsense-edge-hero-banner-desktop-02-en-09aug22?$1600px$",
  detailClose:
    "https://gmedia.playstation.com/is/image/SIEPDC/DualSense-Edge-image-block-05-en-03oct22?$1600px$",
  videoPoster:
    "https://gmedia.playstation.com/is/image/SIEPDC/DualSense-Edge-video-thumbnail-01-en-24aug22?$1600px$",
  kitImage: "/images/kit.jpg",
  ps5Logo: "/images/ps5-logo.png",
  whiteProduct: "/images/produto-branco.jpg",
  midnightProduct: "/images/produto-midnight-black.jpg",
  changeableCapsVideo:
    "https://gmedia.playstation.com/is/content/SIEPDC/global_pdc/en/hardware/accessories/dualsense-edge/channel-specific-content/pdc/2022/features-video-blocks/dualsense-edge-features-changable-caps-video-block-01-en-10oct22.mp4",
  pcCompanion:
    "https://gmedia.playstation.com/is/image/SIEPDC/DualSense_Edge_on_PC?$1600px--t$",
  midnight:
    "https://gmedia.playstation.com/is/image/SIEPDC/dualsense-edge-midnight-collection-image-block-01-en-09jan25?$1600px--t$",
  chargingDock:
    "https://gmedia.playstation.com/is/image/SIEPDC/DualSense-Edge-charging-dock-image-block-01-en-06jan22?$1600px--t$",
  sceneBackdrop:
    "https://gmedia.playstation.com/is/image/SIEPDC/dualsense-edge-background-block-desktop-01-en-10aug22?$1600px$",
};

export const heroStats = [
  { value: "4", label: "perfis r\u00e1pidos" },
  { value: "3", label: "camadas de ajuste" },
  { value: "2", label: "bot\u00f5es traseiros" },
  { value: "1", label: "joystick" },
];

export const highlights = [
  {
    eyebrow: "Performance",
    title: "Gatilhos com percurso ajust\u00e1vel",
    body: "Defina cursos curtos para disparos r\u00e1pidos ou mantenha a amplitude total para corridas e aventuras.",
  },
  {
    eyebrow: "Controle",
    title: "Mapeamento de bot\u00f5es",
    body: "Remapeie comandos essenciais e leve atalhos para os bot\u00f5es traseiros sem quebrar o ritmo da partida.",
  },
  {
    eyebrow: "Precis\u00e3o",
    title: "Sensibilidade dos anal\u00f3gicos",
    body: "Ajuste zonas mortas, curvas de resposta e intensidade de vibra\u00e7\u00e3o para cada tipo de jogo.",
  },
  {
    eyebrow: "Fluxo",
    title: "Perfis altern\u00e1veis",
    body: "Troque entre configura\u00e7\u00f5es salvas direto pelo controle, com acesso r\u00e1pido ao menu de perfil.",
  },
];

export const storySteps = [
  {
    label: "01",
    title: "Ajuste fino, sem pausar o jogo",
    body: "A proposta do redesign e dar ao produto uma leitura cinematogr\u00e1fica: o controle fica em cena enquanto cada recurso entra por scroll, como uma demo guiada.",
  },
  {
    label: "02",
    title: "Tudo que importa no polegar",
    body: "Bot\u00f5es traseiros, perfis e curvas de resposta viram blocos de decis\u00e3o claros para quem joga competitivo ou quer mais conforto.",
  },
  {
    label: "03",
    title: "Hardware modular com cara premium",
    body: "Capas de anal\u00f3gicos troc\u00e1veis, m\u00f3dulos substitu\u00edveis e estojo de transporte entram como parte da narrativa, n\u00e3o como uma lista t\u00e9cnica solta.",
  },
  {
    label: "04",
    title: "PS5 e PC no mesmo ecossistema",
    body: "O produto tamb\u00e9m ganha uma se\u00e7\u00e3o para uso no PC, com a l\u00f3gica de perfis e personaliza\u00e7\u00e3o apresentada como uma bancada de configura\u00e7\u00e3o.",
  },
];

export const featureTiles = [
  {
    title: "Anal\u00f3gicos em foco",
    body: "Curvas, zonas mortas e capas intercambi\u00e1veis para calibrar mira, c\u00e2mera e movimenta\u00e7\u00e3o.",
    image: productAssets.detailClose,
  },
  {
    title: "Perfis prontos para alternar",
    body: "FPS, corrida, a\u00e7\u00e3o e cria\u00e7\u00e3o podem ter par\u00e2metros pr\u00f3prios e atalhos independentes.",
    image: productAssets.videoPoster,
  },
  {
    title: "Capas de controle personaliz\u00e1veis",
    body: "Alterne entre capas padr\u00e3o, altas e baixas para ajustar conforto, ader\u00eancia e precis\u00e3o.",
    video: productAssets.changeableCapsVideo,
  },
  {
    title: "Edi\u00e7\u00e3o Padr\u00e3o (Branco)",
    body: "A assinatura branca destaca o contraste do DualSense Edge e combina com o ecossistema PS5.",
    image: productAssets.heroProduct,
  },
  {
    title: "Edi\u00e7\u00e3o Midnight Black",
    body: "Uma leitura mais s\u00f3bria para destacar textura, sombra e acabamento.",
    image: productAssets.midnight,
  },
];

export type ProfileKey = "fps" | "racing" | "action" | "creator";

export const profiles: Record<
  ProfileKey,
  {
    name: string;
    caption: string;
    trigger: number;
    stick: number;
    vibration: number;
    backButtons: string;
  }
> = {
  fps: {
    name: "FPS",
    caption: "Resposta curta, mira firme e comandos cr\u00edticos nos bot\u00f5es traseiros.",
    trigger: 92,
    stick: 82,
    vibration: 35,
    backButtons: "Pular + Recarregar",
  },
  racing: {
    name: "Corrida",
    caption: "Curso completo nos gatilhos e vibra\u00e7\u00e3o mais presente para leitura de pista.",
    trigger: 48,
    stick: 62,
    vibration: 78,
    backButtons: "C\u00e2mbio + Vis\u00e3o",
  },
  action: {
    name: "A\u00e7\u00e3o",
    caption: "Equil\u00edbrio entre c\u00e2mera, esquiva e feedback h\u00e1ptico para longas sess\u00f5es.",
    trigger: 66,
    stick: 70,
    vibration: 58,
    backButtons: "Esquiva + Item",
  },
  creator: {
    name: "Creator",
    caption: "Sensibilidade suave para captura, edi\u00e7\u00e3o e uso no PC.",
    trigger: 40,
    stick: 52,
    vibration: 22,
    backButtons: "Clip + Menu",
  },
};

export const kitItems = [
  "Capas de anal\u00f3gico padr\u00e3o, altas e baixas",
  "Bot\u00f5es traseiros meia-lua e alavanca",
  "Cabo USB tran\u00e7ado com trava",
  "Estojo de transporte com abertura para carregamento",
];
