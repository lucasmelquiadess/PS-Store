import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowUpRight,
  Boxes,
  ChevronDown,
  Cpu,
  Gamepad2,
  LogOut,
  Monitor,
  PackageCheck,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  featureTiles,
  heroStats,
  highlights,
  kitItems,
  officialLinks,
  productAssets,
  profiles,
  storySteps,
  type ProfileKey,
} from "./data/product";
import { CartPage } from "./components/CartPage";
import { LoginPage } from "./components/LoginPage";
import { AccountPage } from "./components/AccountPage";
import { PaymentCheckoutPage } from "./components/PaymentCheckoutPage";
import { useCart } from "./hooks/useCart";
import { useThreeStage } from "./hooks/useThreeStage";
import { getCurrentUser, logout, type AuthUser } from "./lib/authApi";
import {
  clearPendingCheckout,
  readPendingCheckout,
} from "./lib/checkoutSession";

const profileKeys: ProfileKey[] = ["fps", "racing", "action", "creator"];

type RouteState = {
  hash: string;
  pathname: string;
};

function getRouteState(): RouteState {
  return {
    hash: window.location.hash,
    pathname: window.location.pathname,
  };
}

function shouldUseBrowserNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  );
}

function useRouteNavigation() {
  const [route, setRoute] = useState<RouteState>(() => getRouteState());

  useEffect(() => {
    const handleRouteChange = () => setRoute(getRouteState());
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  useEffect(() => {
    if (route.pathname !== "/") {
      window.scrollTo({ top: 0 });
      return;
    }

    if (!route.hash) {
      window.scrollTo({ top: 0 });
      return;
    }

    document.getElementById(route.hash.slice(1))?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [route]);

  const navigate = useCallback(
    (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (shouldUseBrowserNavigation(event)) {
        return;
      }

      const url = new URL(href, window.location.origin);

      if (url.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      window.history.pushState(null, "", `${url.pathname}${url.hash}`);
      setRoute(getRouteState());
    },
    [],
  );

  const goTo = useCallback((href: string) => {
    const url = new URL(href, window.location.origin);

    if (url.origin !== window.location.origin) {
      window.location.href = href;
      return;
    }

    window.history.pushState(null, "", `${url.pathname}${url.hash}`);
    setRoute(getRouteState());
  }, []);

  return { goTo, navigate, route };
}

function useLandingAnimation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      document.documentElement.classList.add("reduced-motion");
      return () => document.documentElement.classList.remove("reduced-motion");
    }

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.from(".hero-copy > *", {
        y: 36,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
      });

      gsap.from(".hero-controller", {
        y: 46,
        opacity: 0,
        scale: 0.94,
        duration: 1.1,
        ease: "power3.out",
      });

      gsap.to(".hero-controller", {
        y: 110,
        scale: 0.86,
        rotate: 1.5,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });

      gsap.utils.toArray<HTMLElement>(".reveal").forEach((element) => {
        gsap.from(element, {
          y: 46,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 82%",
          },
        });
      });

      const storyCards = gsap.utils.toArray<HTMLElement>(".story-card");
      storyCards.forEach((card, index) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top 58%",
          end: "bottom 42%",
          onToggle: (self) => {
            if (!self.isActive) {
              return;
            }

            storyCards.forEach((item) => item.classList.remove("is-active"));
            card.classList.add("is-active");
            gsap.to(".story-product", {
              rotate: index % 2 === 0 ? -2 : 2,
              y: index * -10,
              scale: 1 + index * 0.018,
              duration: 0.55,
              ease: "power2.out",
            });
          },
        });
      });

      gsap.to(".detail-image", {
        yPercent: -12,
        ease: "none",
        scrollTrigger: {
          trigger: ".detail-band",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    });

    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const rail = document.querySelector<HTMLElement>(".spec-rail");
      if (!rail) {
        return undefined;
      }

      const distance = () =>
        Math.max(0, rail.scrollWidth - window.innerWidth + 96);

      if (distance() <= 0) {
        return undefined;
      }

      const tween = gsap.to(rail, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: ".spec-scroll",
          start: "top top",
          end: () => `+=${distance() + 640}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });

      return () => tween.kill();
    });

    return () => {
      mm.revert();
      ctx.revert();
    };
  }, [enabled]);
}

function MetricBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="metric-row">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function App() {
  const threeStageRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [profileKey, setProfileKey] = useState<ProfileKey>("fps");
  const activeProfile = profiles[profileKey];
  const {
    addItem,
    clearCart,
    items,
    quantity,
    removeItem,
    updateItemQuantity,
  } = useCart();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [accountSectionRequestKey, setAccountSectionRequestKey] = useState(0);
  const { goTo, navigate, route } = useRouteNavigation();
  const isCartPage = route.pathname === "/carrinho";
  const isLoginPage = route.pathname === "/login";
  const isAccountPage = route.pathname === "/minha-conta";
  const isPaymentPage = route.pathname === "/pagamento";
  const isCheckoutFlow =
    isCartPage || isLoginPage || isAccountPage || isPaymentPage;

  useThreeStage(threeStageRef, !isCheckoutFlow);
  useLandingAnimation(!isCheckoutFlow);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setAuthUser(user))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const finishUserLogout = useCallback(() => {
    setAuthUser(null);
    clearPendingCheckout();
    setIsAccountMenuOpen(false);
    goTo("/login");
  }, [goTo]);

  const handleUserLogout = useCallback(async () => {
    await logout();
    finishUserLogout();
  }, [finishUserLogout]);

  const handleOrderApproved = useCallback(() => {
    clearCart();
    clearPendingCheckout();
    setAccountSectionRequestKey((current) => current + 1);
    goTo("/minha-conta#pedidos");
  }, [clearCart, goTo]);

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <>
      <header className="site-nav" aria-label="Navegação principal">
        <a
          className="brand-lockup"
          href="/"
          onClick={navigate("/")}
          aria-label="Sony DualSense Edge"
        >
          <span className="brand-symbol" aria-hidden="true">
            <img src="/sony-logo.png" alt="" />
          </span>
          <span>DualSense Edge</span>
        </a>
        <nav className="nav-links" aria-label="Seções">
          <a href="/#destaques" onClick={navigate("/#destaques")}>
            Destaques
          </a>
          <a href="/#controle" onClick={navigate("/#controle")}>
            Controle
          </a>
          <a href="/#perfis" onClick={navigate("/#perfis")}>
            Perfis
          </a>
          <a href="/#kit" onClick={navigate("/#kit")}>
            Kit
          </a>
        </nav>
        {authUser ? (
          <div
            className={`account-menu ${isAccountMenuOpen ? "is-open" : ""}`}
            ref={accountMenuRef}
            onFocusCapture={() => setIsAccountMenuOpen(true)}
            onMouseEnter={() => setIsAccountMenuOpen(true)}
          >
            <a
              className="account-nav-link"
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
              aria-label="Abrir Minha Conta"
              href="/minha-conta"
              onClick={(event) => {
                setAccountSectionRequestKey((current) => current + 1);
                navigate("/minha-conta")(event);
              }}
            >
              <UserRound size={17} aria-hidden="true" />
              <span>{authUser.fullName.split(" ")[0]}</span>
            </a>
            <div className="account-dropdown" role="menu">
              <a
                href="/minha-conta#pedidos"
                onClick={(event) => {
                  setAccountSectionRequestKey((current) => current + 1);
                  navigate("/minha-conta#pedidos")(event);
                }}
                role="menuitem"
              >
                <PackageCheck size={17} aria-hidden="true" />
                Meus Pedidos
              </a>
              <button
                type="button"
                onClick={() => void handleUserLogout()}
                role="menuitem"
              >
                <LogOut size={17} aria-hidden="true" />
                Sair
              </button>
            </div>
          </div>
        ) : (
          <a
            className="account-nav-link"
            href="/login"
            onClick={navigate("/login")}
            aria-label="Acessar Minha Conta"
            title="Criar conta ou entrar"
          >
            <UserRound size={17} aria-hidden="true" />
            <span>Minha Conta</span>
          </a>
        )}
        <a
          className="nav-action"
          href="/carrinho"
          onClick={navigate("/carrinho")}
          aria-label={
            quantity > 0
              ? `Abrir carrinho com ${quantity} item${quantity > 1 ? "s" : ""}`
              : "Abrir meu carrinho"
          }
          title="Meu Carrinho"
        >
          <ShoppingBag size={18} aria-hidden="true" />
          <span>Meu Carrinho</span>
          {quantity > 0 && (
            <strong className="cart-badge" aria-hidden="true">
              {quantity}
            </strong>
          )}
        </a>
      </header>

      {isCartPage ? (
        <CartPage
          isAuthenticated={Boolean(authUser)}
          items={items}
          onAddItem={addItem}
          onCheckoutComplete={() => goTo("/pagamento")}
          onCheckoutLogin={() => goTo("/login")}
          onClearCart={clearCart}
          onNavigateHome={navigate("/")}
          onRemoveItem={removeItem}
          onUpdateItemQuantity={updateItemQuantity}
          quantity={quantity}
        />
      ) : isLoginPage ? (
        <LoginPage
          onAuthenticated={async (user) => {
            setAuthUser(user);
            const pendingCheckout = readPendingCheckout();

            if (pendingCheckout && items.length > 0) {
              goTo("/pagamento");
              return;
            }

            clearPendingCheckout();
            goTo("/minha-conta");
          }}
          onNavigateCart={navigate("/carrinho")}
        />
      ) : isPaymentPage ? (
        <PaymentCheckoutPage
          isAuthReady={authReady}
          items={items}
          onNavigateAccount={navigate("/minha-conta")}
          onNavigateCart={navigate("/carrinho")}
          onOrderApproved={handleOrderApproved}
          onRequireLogin={() => goTo("/login")}
          user={authUser}
        />
      ) : isAccountPage ? (
        <AccountPage
          initialSection={route.hash === "#pedidos" ? "pedidos" : "cadastro"}
          isAuthReady={authReady}
          onNavigateCart={navigate("/carrinho")}
          onNavigateLogin={navigate("/login")}
          onUserDeleted={() => {
            setAuthUser(null);
            goTo("/login");
          }}
          onUserLoggedOut={() => {
            finishUserLogout();
          }}
          onUserUpdated={setAuthUser}
          sectionRequestKey={accountSectionRequestKey}
          user={authUser}
        />
      ) : (
      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-stage" ref={threeStageRef} aria-hidden="true" />
          <div className="hero-vignette" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow">Controle profissional para PS5</p>
            <h1 id="hero-title">
              Controle sem fio <span>DualSense Edge<sup>®</sup></span>
            </h1>
            <p className="hero-lead">
              Uma landing page conceitual para apresentar customização,
              precisão e modularidade com uma narrativa de produto guiada por
              scroll.
            </p>
            <div className="hero-actions" aria-label="Ações principais">
              <a className="button primary explore-button" href="#destaques">
                <Sparkles size={18} aria-hidden="true" />
                Explorar produto
              </a>
              <a
                className="button ghost buy-button"
                href="/carrinho"
                onClick={navigate("/carrinho")}
              >
                <ArrowUpRight size={18} aria-hidden="true" />
                Comprar agora
              </a>
            </div>
          </div>

          <div className="hero-media" aria-hidden="true">
            <img
              className="hero-controller"
              src={productAssets.heroProduct}
              alt=""
              loading="eager"
            />
          </div>

          <div className="hero-stats" aria-label="Resumo do produto">
            {heroStats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          <a
            className="scroll-cue"
            href="#destaques"
            aria-label="Ir para os destaques"
            title="Ir para os destaques"
          >
            <ChevronDown size={22} aria-hidden="true" />
          </a>
        </section>

        <section className="section highlights" id="destaques">
          <div className="section-heading reveal">
            <p className="eyebrow">Comece pelos destaques</p>
            <h2>Precisão, resposta e controle em primeiro plano.</h2>
            <p>
              O DualSense Edge destaca ajustes profissionais, componentes
              modulares e perfis rápidos para quem quer adaptar cada partida ao
              próprio jeito de jogar.
            </p>
          </div>

          <div className="highlight-grid">
            {highlights.map((item, index) => {
              const icons = [
                SlidersHorizontal,
                Gamepad2,
                Radio,
                RotateCcw,
              ];
              const Icon = icons[index];
              return (
                <article className="highlight-card reveal" key={item.title}>
                  <Icon size={24} aria-hidden="true" />
                  <p>{item.eyebrow}</p>
                  <h3>{item.title}</h3>
                  <span>{item.body}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="story section" id="controle">
          <div className="story-visual" aria-hidden="true">
            <div className="story-product-wrap">
              <img
                className="story-product"
                src={productAssets.heroProduct}
                alt=""
                loading="lazy"
              />
              <div className="focus-ring" />
            </div>
          </div>
          <div className="story-copy">
            <p className="eyebrow reveal">Narrativa por scroll</p>
            <h2 className="reveal">Cada ajuste aparece no seu tempo.</h2>
            {storySteps.map((step) => (
              <article className="story-card reveal" key={step.label}>
                <span>{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="spec-scroll" aria-labelledby="spec-title">
          <div className="spec-intro">
            <p className="eyebrow">Demonstração horizontal</p>
            <h2 id="spec-title">Um carrossel de recursos conduzido pelo scroll.</h2>
          </div>
          <div className="spec-rail">
            {featureTiles.map((tile) => (
              <article className="feature-tile" key={tile.title}>
                {"video" in tile ? (
                  <video
                    src={tile.video}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={tile.title}
                  />
                ) : (
                  <img src={tile.image} alt="" loading="lazy" />
                )}
                <div>
                  <h3>{tile.title}</h3>
                  <p>{tile.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section configurator" id="perfis">
          <div className="section-heading reveal">
            <p className="eyebrow">Bancada interativa</p>
            <h2>Perfis de controle como parte da experiência.</h2>
            <p>
              Em vez de listar possibilidades, o usuário testa mentalmente
              cenários de jogo e entende como cada perfil muda o comportamento.
            </p>
          </div>

          <div className="lab reveal">
            <div className="profile-tabs" role="tablist" aria-label="Perfis">
              {profileKeys.map((key) => (
                <button
                  className={profileKey === key ? "is-selected" : ""}
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={profileKey === key}
                  onClick={() => setProfileKey(key)}
                >
                  {profiles[key].name}
                </button>
              ))}
            </div>

            <div className="profile-panel" role="tabpanel">
              <div className="profile-copy">
                <Gamepad2 size={28} aria-hidden="true" />
                <h3>{activeProfile.name}</h3>
                <p>{activeProfile.caption}</p>
                <dl>
                  <div>
                    <dt>Botões traseiros</dt>
                    <dd>{activeProfile.backButtons}</dd>
                  </div>
                  <div>
                    <dt>Troca rápida</dt>
                    <dd>Menu de perfil no controle</dd>
                  </div>
                </dl>
              </div>
              <div className="profile-metrics">
                <MetricBar label="Curso dos gatilhos" value={activeProfile.trigger} />
                <MetricBar label="Resposta dos analógicos" value={activeProfile.stick} />
                <MetricBar label="Intensidade de vibração" value={activeProfile.vibration} />
              </div>
            </div>
          </div>
        </section>

        <section className="detail-band">
          <div className="detail-copy reveal">
            <p className="eyebrow">Design por PlayStation<sup>®</sup></p>
            <h2>Precisão visível, conforto discreto.</h2>
            <p>
              O visual combina um produto grande em primeiro plano com camadas
              técnicas ao fundo: menos vitrine estática, mais apresentação de
              engenharia.
            </p>
          </div>
          <img
            className="detail-image"
            src={productAssets.detailClose}
            alt="Detalhe do controle sem fio DualSense Edge"
            loading="lazy"
          />
        </section>

        <section className="section kit" id="kit">
          <div className="kit-copy reveal">
            <p className="eyebrow">Kit Edge</p>
            <h2>O estojo vira argumento de produto.</h2>
            <p>
              Acessórios entram como prova de uso profissional: transportar,
              trocar, configurar e voltar para a partida.
            </p>
            <ul>
              {kitItems.map((item) => (
                <li key={item}>
                  <ShieldCheck size={18} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="kit-media reveal">
            <img
              src={productAssets.kitImage}
              alt="Controle DualSense Edge com estojo e acessórios"
              loading="lazy"
            />
          </div>
        </section>

        <section className="ecosystem">
          <div className="ecosystem-media reveal">
            <img
              src={productAssets.pcCompanion}
              alt="DualSense Edge sendo configurado no PC"
              loading="lazy"
            />
          </div>
          <div className="ecosystem-copy reveal">
            <p className="eyebrow">PS5 + PC</p>
            <h2>Um painel final para fechar a intenção de compra.</h2>
            <div className="ecosystem-grid">
              <article>
                <Monitor size={24} aria-hidden="true" />
                <h3>Companion app</h3>
                <p>Personalização também no PC com foco em perfis e ajustes.</p>
              </article>
              <article>
                <Cpu size={24} aria-hidden="true" />
                <h3>Hardware modular</h3>
                <p>Partes substituíveis reforçam a vida útil do controle.</p>
              </article>
              <article>
                <Boxes size={24} aria-hidden="true" />
                <h3>Ecossistema</h3>
                <p>Controle, base, cabo e estojo em um conjunto coerente.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <img
            className="ps5-logo"
            src={productAssets.ps5Logo}
            alt="PlayStation 5"
            loading="lazy"
          />
          <p className="eyebrow">Projeto de estudo</p>
          <h2>Lucas Melquiades</h2>
          <div className="hero-actions">
            <a className="button primary" href={officialLinks.playstation} target="_blank" rel="noreferrer">
              <Play size={18} aria-hidden="true" />
              Ver produto oficial
            </a>
            <a className="button ghost" href="#top">
              <ChevronDown className="up-icon" size={18} aria-hidden="true" />
              Voltar ao topo
            </a>
          </div>
        </section>
      </main>
      )}

      <footer className="site-footer">
        <p>
          Conceito independente para estudo de UI/UX, front-end e back-end.
          PlayStation, DualSense e marcas relacionadas pertencem aos seus
          respectivos donos.
        </p>
        <span>© {year}</span>
      </footer>
    </>
  );
}

export default App;
