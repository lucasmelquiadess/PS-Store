import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type MouseEventHandler } from "react";
import {
  productColorOptions,
  shopProduct,
  type ProductColorId,
} from "../data/shop";
import { getShippingQuote, type ShippingQuote } from "../lib/commerceApi";
import { getCartSubtotalCents, type CartItem } from "../lib/cartStorage";
import {
  readCartCep,
  saveCartCep,
  savePendingCheckout,
} from "../lib/checkoutSession";

type CartPageProps = {
  isAuthenticated: boolean;
  items: CartItem[];
  quantity: number;
  onAddItem: (colorId: ProductColorId) => void;
  onCheckoutComplete: () => void;
  onCheckoutLogin: () => void;
  onClearCart: () => void;
  onNavigateHome: MouseEventHandler<HTMLAnchorElement>;
  onRemoveItem: (itemId: string) => void;
  onUpdateItemQuantity: (itemId: string, quantity: number) => void;
};

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; quote: ShippingQuote }
  | { status: "error"; message: string };

type CheckoutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

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

export function CartPage({
  isAuthenticated,
  items,
  onAddItem,
  onCheckoutComplete,
  onCheckoutLogin,
  onClearCart,
  onNavigateHome,
  onRemoveItem,
  onUpdateItemQuantity,
  quantity,
}: CartPageProps) {
  const [selectedColor, setSelectedColor] = useState<ProductColorId>("white");
  const [cep, setCep] = useState(() => readCartCep());
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({
    status: "idle",
  });
  const [lastAddedColor, setLastAddedColor] = useState<ProductColorId | null>(
    null,
  );

  const selectedOption =
    productColorOptions.find((option) => option.id === selectedColor) ??
    productColorOptions[0];
  const subtotalCents = useMemo(() => getCartSubtotalCents(items), [items]);
  const cleanCep = cep.replace(/\D/g, "");
  const canCheckout =
    quantity > 0 &&
    quoteState.status === "success" &&
    quoteState.quote.options.length > 0;
  const canAttemptCheckout = quantity > 0;

  useEffect(() => {
    saveCartCep(cleanCep);
  }, [cleanCep]);

  useEffect(() => {
    if (cleanCep.length === 0) {
      setQuoteState({ status: "idle" });
      return undefined;
    }

    if (cleanCep.length < 8) {
      setQuoteState({ status: "idle" });
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setQuoteState({ status: "loading" });
      getShippingQuote(cleanCep, controller.signal)
        .then((quote) => setQuoteState({ status: "success", quote }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          setQuoteState({
            message:
              error instanceof Error
                ? error.message
                : "Não foi possível validar o CEP.",
            status: "error",
          });
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [cleanCep]);

  const handleAddToCart = () => {
    onAddItem(selectedColor);
    setLastAddedColor(selectedColor);
  };

  const handleUpdateItemQuantity = (itemId: string, quantity: number) => {
    onUpdateItemQuantity(itemId, quantity);
  };

  const handleRemoveItem = (itemId: string) => {
    onRemoveItem(itemId);
  };

  const handleCheckout = () => {
    if (cleanCep.length === 0) {
      setCheckoutState({
        message: "Preencha o CEP para calcular as opções de entrega.",
        status: "error",
      });
      return;
    }

    if (cleanCep.length < 8) {
      setCheckoutState({
        message: "Digite os 8 números do CEP.",
        status: "error",
      });
      return;
    }

    if (!canCheckout || quoteState.status !== "success") {
      setCheckoutState({
        message: "Aguarde o cálculo das opções de entrega.",
        status: "error",
      });
      return;
    }

    savePendingCheckout({
      cep: cleanCep,
      shippingOptionId: quoteState.quote.options[0].id,
    });

    if (!isAuthenticated) {
      onCheckoutLogin();
      return;
    }

    setCheckoutState({ status: "idle" });
    onCheckoutComplete();
  };

  return (
    <main className="cart-page">
      <section className="cart-hero">
        <a className="cart-back-link" href="/" onClick={onNavigateHome}>
          <ChevronLeft size={18} aria-hidden="true" />
          Voltar ao produto
        </a>
        <p className="eyebrow">Carrinho de compras</p>
        <h1>Finalize sua compra</h1>
        <p>
          {"Escolha a cor, adicione o produto ao carrinho e consulte o seu CEP para verificar as op\u00e7\u00f5es e prazo de entrega."}
        </p>
      </section>

      <div className="cart-layout">
        <div className="cart-column cart-main-column">
          <section className="cart-panel product-builder">
            <div className="product-preview">
              <img src={selectedOption.image} alt={shopProduct.name} />
            </div>
            <div className="product-config">
              <p className="eyebrow">Cor</p>
              <h2>{shopProduct.name}</h2>
              <p>{shopProduct.shortDescription}</p>
              <strong className="product-price">
                {formatCurrency(shopProduct.priceCents)}
              </strong>

              <div className="color-options" aria-label="Escolha a cor">
                {productColorOptions.map((option) => (
                  <button
                    className={
                      selectedColor === option.id
                        ? `is-selected color-${option.id}`
                        : `color-${option.id}`
                    }
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedColor(option.id)}
                  >
                    <span
                      className="color-swatch"
                      style={{ background: option.swatch }}
                      aria-hidden="true"
                    />
                    {option.name}
                  </button>
                ))}
              </div>

              <button
                className="button primary cart-add-button"
                type="button"
                onClick={handleAddToCart}
              >
                <ShoppingBag size={18} aria-hidden="true" />
                Adicionar ao carrinho
              </button>

              {lastAddedColor && (
                <p className="cart-feedback" role="status">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {
                    productColorOptions.find(
                      (option) => option.id === lastAddedColor,
                    )?.name
                  }{" "}
                  adicionado ao carrinho.
                </p>
              )}
            </div>
          </section>

          <section className="cart-panel shipping-panel">
            <div>
              <p className="eyebrow">Entrega</p>
              <h2>Consultar CEP</h2>
            </div>

            <label className="cep-field">
              <span>CEP</span>
              <input
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                value={formatCep(cep)}
                onChange={(event) => {
                  setCep(event.target.value);
                  setCheckoutState({ status: "idle" });
                }}
              />
            </label>

            {cleanCep.length > 0 && cleanCep.length < 8 && (
              <p className="cart-warning">Digite os 8 números do CEP.</p>
            )}

            {quoteState.status === "loading" && (
              <p className="cart-feedback" role="status">
                <Truck size={18} aria-hidden="true" />
                Validando CEP e calculando frete...
              </p>
            )}

            {quoteState.status === "error" && (
              <p className="cart-error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {quoteState.message}
              </p>
            )}

            {quoteState.status === "success" && (
              <div className="shipping-result">
                <div className="address-result">
                  <MapPin size={20} aria-hidden="true" />
                  <p>
                    <strong>
                      {quoteState.quote.address.street ||
                        "Endereço sem logradouro"}
                    </strong>
                    <span>
                      {quoteState.quote.address.neighborhood} -{" "}
                      {quoteState.quote.address.city}/
                      {quoteState.quote.address.state}
                    </span>
                  </p>
                </div>

                <div className="shipping-options">
                  {quoteState.quote.options.map((option) => (
                    <article className="shipping-option" key={option.id}>
                      <PackageCheck size={20} aria-hidden="true" />
                      <div>
                        <h3>{option.name}</h3>
                        <p>
                          {option.carrier} - {option.estimate}
                        </p>
                      </div>
                      <strong>Grátis</strong>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="cart-column cart-side-column">
          <aside className="cart-panel cart-summary" aria-label="Resumo do carrinho">
            <div className="cart-summary-heading">
              <div>
                <p className="eyebrow">Resumo</p>
                <h2>Carrinho</h2>
              </div>
              {quantity > 0 && <span>{quantity}</span>}
            </div>

            {items.length === 0 ? (
              <p className="empty-cart">Seu carrinho ainda está vazio.</p>
            ) : (
              <>
                <div className="cart-items">
                  {items.map((item) => (
                    <article className="cart-item" key={item.id}>
                      <img src={item.image} alt={item.productName} />
                      <div className="cart-item-main">
                        <h3>{item.productName}</h3>
                        <p>{item.colorName}</p>
                        <div
                          className="cart-quantity-control"
                          aria-label={`Quantidade de ${item.colorName}`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemQuantity(
                                item.id,
                                item.quantity - 1,
                              )
                            }
                            disabled={item.quantity <= 1}
                            aria-label={`Diminuir quantidade de ${item.colorName}`}
                          >
                            <Minus size={14} aria-hidden="true" />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateItemQuantity(
                                item.id,
                                item.quantity + 1,
                              )
                            }
                            disabled={item.quantity >= 10}
                            aria-label={`Aumentar quantidade de ${item.colorName}`}
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="cart-item-actions">
                        <button
                          className="cart-remove"
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Remover ${item.colorName} do carrinho`}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                        <strong>
                          {formatCurrency(item.unitPriceCents * item.quantity)}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
                <button className="cart-clear" type="button" onClick={onClearCart}>
                  Limpar carrinho
                </button>
              </>
            )}

            <div className="cart-total">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotalCents)}</strong>
            </div>
          </aside>

          <section className="cart-panel checkout-panel">
            <div>
              <p className="eyebrow">Checkout</p>
              <h2>Finalizar compra</h2>
            </div>

            <button
              className="button primary checkout-button"
              type="button"
              disabled={!canAttemptCheckout || checkoutState.status === "loading"}
              onClick={handleCheckout}
            >
              <CreditCard size={18} aria-hidden="true" />
              {checkoutState.status === "loading" ? "Finalizando..." : "Finalizar compra"}
            </button>

            {checkoutState.status === "error" && (
              <p className="cart-error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {checkoutState.message}
              </p>
            )}

            <p className="checkout-note">
              {"Esta \u00e9 uma simula\u00e7\u00e3o segura: nenhum pagamento real ser\u00e1 processado."}
            </p>

            <section className="payment-methods" aria-label="Formas de pagamento">
              <h3>Formas de Pagamento</h3>

              <div className="payment-row">
                <div>
                  <strong>Cartões de Crédito</strong>
                  <span>em até 6x sem juros (e 12x com juros)</span>
                </div>
                <div
                  className="payment-logos"
                  aria-label="Visa, Mastercard, Elo e American Express"
                >
                  <img
                    className="payment-logo visa"
                    src="/images/payment/visa.png"
                    alt="Visa"
                    loading="lazy"
                  />
                  <img
                    className="payment-logo mastercard"
                    src="/images/payment/mastercard.png"
                    alt="Mastercard"
                    loading="lazy"
                  />
                  <img
                    className="payment-logo elo"
                    src="/images/payment/elo.png"
                    alt="Elo"
                    loading="lazy"
                  />
                  <img
                    className="payment-logo amex"
                    src="/images/payment/amex.png"
                    alt="American Express"
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="payment-row">
                <div>
                  <strong>PIX</strong>
                  <span>Confirmação rápida (para pedidos simulados)</span>
                </div>
                <div className="payment-logos" aria-label="Pix">
                  <img
                    className="payment-logo pix"
                    src="/images/payment/pix.png"
                    alt="Pix"
                    loading="lazy"
                  />
                </div>
              </div>
            </section>

          </section>
        </div>
      </div>
    </main>
  );
}
