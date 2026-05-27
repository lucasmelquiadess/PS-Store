import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  MapPin,
  PackageCheck,
  QrCode,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type MouseEventHandler,
} from "react";
import { getCartSubtotalCents, type CartItem } from "../lib/cartStorage";
import {
  getAddresses,
  type AccountAddress,
  type AuthUser,
} from "../lib/authApi";
import {
  createCheckout,
  getShippingQuote,
  type ShippingOption,
  type ShippingQuote,
} from "../lib/commerceApi";
import {
  readPendingCheckout,
  type PendingCheckout,
} from "../lib/checkoutSession";

type PaymentMethod = "credit_card" | "pix";

type PaymentCheckoutPageProps = {
  isAuthReady: boolean;
  items: CartItem[];
  onNavigateAccount: MouseEventHandler<HTMLAnchorElement>;
  onNavigateCart: MouseEventHandler<HTMLAnchorElement>;
  onOrderApproved: () => void;
  onRequireLogin: () => void;
  user: AuthUser | null;
};

type AsyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; quote: ShippingQuote }
  | { status: "error"; message: string };

type CheckoutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; orderCode: string }
  | { status: "error"; message: string };

const paymentOptions: Array<{
  description: string;
  icon: typeof CreditCard;
  id: PaymentMethod;
  label: string;
}> = [
  {
    description: "Visa, Mastercard, Elo ou American Express",
    icon: CreditCard,
    id: "credit_card",
    label: "Cartões de crédito",
  },
  {
    description: "Confirmação rápida para pedidos simulados",
    icon: QrCode,
    id: "pix",
    label: "PIX",
  },
];

function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueInCents / 100);
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function getAddressLine(address: AccountAddress) {
  const complement = address.complement ? ` - ${address.complement}` : "";
  return `${address.street}, ${address.number}${complement} - ${address.neighborhood}`;
}

function getAddressCityLine(address: AccountAddress) {
  return `${address.city}/${address.state} - CEP ${formatCep(address.cep)}`;
}

function getPreferredAddress(
  addresses: AccountAddress[],
  pendingCheckout: PendingCheckout | null,
) {
  return (
    addresses.find((address) => address.cep === pendingCheckout?.cep) ??
    addresses.find((address) => address.isPrimary) ??
    addresses[0] ??
    null
  );
}

function getSelectedShippingOption(
  quoteState: QuoteState,
  pendingCheckout: PendingCheckout | null,
) {
  if (quoteState.status !== "success") {
    return null;
  }

  return (
    quoteState.quote.options.find(
      (option) => option.id === pendingCheckout?.shippingOptionId,
    ) ?? quoteState.quote.options[0] ?? null
  );
}

export function PaymentCheckoutPage({
  isAuthReady,
  items,
  onNavigateAccount,
  onNavigateCart,
  onOrderApproved,
  onRequireLogin,
  user,
}: PaymentCheckoutPageProps) {
  const pendingCheckout = useMemo(() => readPendingCheckout(), []);
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressState, setAddressState] = useState<AsyncState>({
    status: "idle",
  });
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({
    status: "idle",
  });

  const subtotalCents = useMemo(() => getCartSubtotalCents(items), [items]);
  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );
  const selectedShippingOption = getSelectedShippingOption(
    quoteState,
    pendingCheckout,
  );
  const canConclude = Boolean(
    selectedAddress &&
      selectedShippingOption &&
      paymentMethod &&
      checkoutState.status !== "loading",
  );

  useEffect(() => {
    if (isAuthReady && !user) {
      onRequireLogin();
    }
  }, [isAuthReady, onRequireLogin, user]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setAddresses([]);
      return undefined;
    }

    setAddressState({ status: "loading" });
    getAddresses()
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        const nextAddresses = payload.addresses;
        const preferredAddress = getPreferredAddress(
          nextAddresses,
          pendingCheckout,
        );

        setAddresses(nextAddresses);
        setSelectedAddressId((current) =>
          nextAddresses.some((address) => address.id === current)
            ? current
            : preferredAddress?.id ?? "",
        );
        setAddressState({ status: "idle" });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setAddressState({
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar seus endereços.",
          status: "error",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [pendingCheckout, user]);

  useEffect(() => {
    if (!selectedAddress) {
      setQuoteState({ status: "idle" });
      return undefined;
    }

    const controller = new AbortController();
    setQuoteState({ status: "loading" });

    getShippingQuote(selectedAddress.cep, controller.signal)
      .then((quote) => setQuoteState({ quote, status: "success" }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setQuoteState({
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível confirmar o frete grátis.",
          status: "error",
        });
      });

    return () => controller.abort();
  }, [selectedAddress]);

  useEffect(() => {
    if (checkoutState.status !== "success") {
      return undefined;
    }

    const timer = window.setTimeout(onOrderApproved, 1800);
    return () => window.clearTimeout(timer);
  }, [checkoutState.status, onOrderApproved]);

  const handleConclude = async () => {
    if (!selectedAddress || !selectedShippingOption || !paymentMethod) {
      return;
    }

    setCheckoutState({ status: "loading" });

    try {
      const result = await createCheckout({
        addressId: selectedAddress.id,
        cep: selectedAddress.cep,
        items,
        paymentMethod,
        shippingOptionId: selectedShippingOption.id,
      });

      setCheckoutState({
        orderCode: result.orderId,
        status: "success",
      });
    } catch (error) {
      setCheckoutState({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o pedido.",
        status: "error",
      });
    }
  };

  if (!isAuthReady) {
    return (
      <main className="payment-page">
        <section className="cart-hero">
          <p className="eyebrow">Área segura</p>
          <h1>Carregando checkout</h1>
          <p>Estamos preparando seus dados de compra.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="payment-page">
        <section className="cart-hero">
          <p className="eyebrow">Área segura</p>
          <h1>Entre para continuar</h1>
          <p>Você será direcionado para login e cadastro.</p>
        </section>
      </main>
    );
  }

  if (checkoutState.status === "success") {
    return (
      <main className="payment-approved-page">
        <section className="payment-approved-card" role="status">
          <CheckCircle2 size={56} aria-hidden="true" />
          <p className="eyebrow">Pagamento aprovado</p>
          <h1>Pagamento aprovado</h1>
          <p>
            Pedido {checkoutState.orderCode} confirmado. Abrindo Meus Pedidos...
          </p>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="payment-page">
        <section className="cart-hero">
          <a className="cart-back-link" href="/carrinho" onClick={onNavigateCart}>
            <ChevronLeft size={18} aria-hidden="true" />
            Voltar ao carrinho
          </a>
          <p className="eyebrow">Pagamento</p>
          <h1>Carrinho vazio</h1>
          <p>Adicione o produto ao carrinho antes de escolher o pagamento.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="payment-page">
      <section className="cart-hero payment-hero">
        <a className="cart-back-link" href="/carrinho" onClick={onNavigateCart}>
          <ChevronLeft size={18} aria-hidden="true" />
          Voltar ao carrinho
        </a>
        <p className="eyebrow">Pagamento seguro</p>
        <h1>Concluir pedido</h1>
        <p>
          Confirme o endereço, selecione uma forma de pagamento e conclua o
          pedido simulado.
        </p>
      </section>

      <div className="payment-layout">
        <div className="payment-main">
          <section className="cart-panel payment-step">
            <div className="payment-step-heading">
              <span>1</span>
              <div>
                <p className="eyebrow">Entrega</p>
                <h2>Endereço de entrega</h2>
              </div>
            </div>

            {addressState.status === "loading" && (
              <p className="cart-feedback" role="status">
                <Truck size={18} aria-hidden="true" />
                Carregando endereços...
              </p>
            )}

            {addressState.status === "error" && (
              <p className="cart-error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {addressState.message}
              </p>
            )}

            {addresses.length > 0 ? (
              <div className="payment-address-list">
                {addresses.map((address) => (
                  <button
                    className={
                      selectedAddressId === address.id ? "is-selected" : ""
                    }
                    key={address.id}
                    type="button"
                    onClick={() => setSelectedAddressId(address.id)}
                  >
                    <MapPin size={20} aria-hidden="true" />
                    <span>
                      <strong>
                        {address.label}
                        {address.isPrimary ? " - Principal" : ""}
                      </strong>
                      {getAddressLine(address)}
                      <small>{getAddressCityLine(address)}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              addressState.status !== "loading" && (
                <div className="account-empty-state">
                  <MapPin size={28} aria-hidden="true" />
                  <p>Cadastre um endereço antes de concluir.</p>
                  <a
                    className="button primary secure-action"
                    href="/minha-conta"
                    onClick={onNavigateAccount}
                  >
                    Minha Conta
                  </a>
                </div>
              )
            )}

            {quoteState.status === "loading" && selectedAddress && (
              <p className="cart-feedback" role="status">
                <Truck size={18} aria-hidden="true" />
                Confirmando frete grátis...
              </p>
            )}

            {quoteState.status === "error" && (
              <p className="cart-error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {quoteState.message}
              </p>
            )}

            {selectedAddress && selectedShippingOption && (
              <ShippingConfirmation
                address={selectedAddress}
                option={selectedShippingOption}
              />
            )}
          </section>

          <section className="cart-panel payment-step">
            <div className="payment-step-heading">
              <span>2</span>
              <div>
                <p className="eyebrow">Pagamento</p>
                <h2>Forma de pagamento</h2>
              </div>
            </div>

            <div className="payment-choice-grid">
              {paymentOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    className={paymentMethod === option.id ? "is-selected" : ""}
                    key={option.id}
                    type="button"
                    onClick={() => setPaymentMethod(option.id)}
                  >
                    <Icon size={22} aria-hidden="true" />
                    <span>
                      <strong>{option.label}</strong>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="cart-panel payment-summary">
          <div>
            <p className="eyebrow">Resumo</p>
            <h2>Seu pedido</h2>
          </div>

          <div className="payment-summary-items">
            {items.map((item) => (
              <article key={item.id}>
                <img src={item.image} alt={item.productName} />
                <div>
                  <h3>{item.productName}</h3>
                  <p>
                    {item.colorName} - Quantidade {item.quantity}
                  </p>
                </div>
                <strong>{formatCurrency(item.unitPriceCents * item.quantity)}</strong>
              </article>
            ))}
          </div>

          <div className="payment-summary-total">
            <span>Produtos</span>
            <strong>{formatCurrency(subtotalCents)}</strong>
          </div>
          <div className="payment-summary-total">
            <span>Frete</span>
            <strong>Grátis</strong>
          </div>
          <div className="payment-summary-total is-final">
            <span>Total</span>
            <strong>{formatCurrency(subtotalCents)}</strong>
          </div>

          <button
            className="button primary checkout-button payment-submit"
            type="button"
            disabled={!canConclude}
            onClick={handleConclude}
          >
            <ShieldCheck size={18} aria-hidden="true" />
            {checkoutState.status === "loading" ? "Concluindo..." : "Concluir"}
          </button>

          {checkoutState.status === "error" && (
            <p className="cart-error" role="alert">
              <XCircle size={18} aria-hidden="true" />
              {checkoutState.message}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function ShippingConfirmation({
  address,
  option,
}: {
  address: AccountAddress;
  option: ShippingOption;
}) {
  return (
    <article className="shipping-confirmation">
      <PackageCheck size={22} aria-hidden="true" />
      <div>
        <h3>Entrega grátis confirmada</h3>
        <p>
          {option.carrier} - {option.estimate}
        </p>
        <span>
          {getAddressLine(address)} - {address.city}/{address.state}
        </span>
      </div>
      <strong>Grátis</strong>
    </article>
  );
}
