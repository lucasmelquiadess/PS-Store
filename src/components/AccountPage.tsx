import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Home,
  LogOut,
  MapPin,
  PackageCheck,
  Plus,
  Save,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEventHandler,
} from "react";
import {
  createAddress,
  deleteAddress,
  deleteProfile,
  getAddresses,
  getOrders,
  logout,
  setPrimaryAddress,
  updateAddress,
  updateProfile,
  type AccountAddress,
  type AccountOrder,
  type AddressPayload,
  type AuthUser,
  type EditableProfilePayload,
  type Gender,
} from "../lib/authApi";

type AccountSection = "cadastro" | "enderecos" | "pedidos";

type AccountPageProps = {
  initialSection: AccountSection;
  isAuthReady: boolean;
  onNavigateCart: MouseEventHandler<HTMLAnchorElement>;
  onNavigateLogin: MouseEventHandler<HTMLAnchorElement>;
  onUserDeleted: () => void;
  onUserLoggedOut: () => void;
  onUserUpdated: (user: AuthUser) => void;
  sectionRequestKey: number;
  user: AuthUser | null;
};

type AsyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const brazilianStates = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const emptyAddressData: AddressPayload = {
  cep: "",
  city: "",
  complement: "",
  label: "",
  neighborhood: "",
  number: "",
  recipientName: "",
  state: "",
  street: "",
};

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

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function toEditableProfile(user: AuthUser): EditableProfilePayload {
  return {
    birthDate: user.birthDate,
    cep: user.cep,
    city: user.city,
    complement: user.complement,
    fullName: user.fullName,
    gender: user.gender,
    neighborhood: user.neighborhood,
    number: user.number,
    phone: user.phone,
    state: user.state,
    street: user.street,
  };
}

function toAddressPayload(address: AccountAddress): AddressPayload {
  return {
    cep: address.cep,
    city: address.city,
    complement: address.complement,
    isPrimary: address.isPrimary,
    label: address.label,
    neighborhood: address.neighborhood,
    number: address.number,
    recipientName: address.recipientName,
    state: address.state,
    street: address.street,
  };
}

function buildDefaultAddress(user: AuthUser): AddressPayload {
  return {
    cep: user.cep,
    city: user.city,
    complement: user.complement,
    isPrimary: false,
    label: "Entrega",
    neighborhood: user.neighborhood,
    number: user.number,
    recipientName: user.fullName,
    state: user.state,
    street: user.street,
  };
}

function isValidPhone(value: string) {
  return /^\(\d{2}\) 9\d{4}-\d{4}$/.test(value);
}

function isBrazilianState(value: string) {
  return brazilianStates.includes(value as (typeof brazilianStates)[number]);
}

const orderStatusSteps: Array<{
  key: AccountOrder["status"];
  label: string;
}> = [
  { key: "realizado", label: "Realizado" },
  { key: "pagamento_aprovado", label: "Pagamento aprovado" },
  { key: "nf_emitida", label: "NF emitida" },
  { key: "enviado", label: "Enviado" },
  { key: "entregue", label: "Entregue" },
];

function getOrderStatusLabel(status: AccountOrder["status"]) {
  return (
    orderStatusSteps.find((step) => step.key === status)?.label ??
    "Pagamento aprovado"
  );
}

function OrderStatusTimeline({ status }: { status: AccountOrder["status"] }) {
  const currentIndex = Math.max(
    0,
    orderStatusSteps.findIndex((step) => step.key === status),
  );
  const progress = `${((currentIndex + 1) / orderStatusSteps.length) * 100}%`;

  return (
    <section
      className="order-status-timeline"
      aria-label={`Status do pedido: ${getOrderStatusLabel(status)}`}
    >
      <div className="order-status-heading">
        <span>Acompanhamento</span>
        <strong>{getOrderStatusLabel(status)}</strong>
      </div>
      <div className="order-status-track" aria-hidden="true">
        <span style={{ width: progress }} />
      </div>
      <ol>
        {orderStatusSteps.map((step, index) => (
          <li
            className={index <= currentIndex ? "is-complete" : ""}
            key={step.key}
          >
            <span />
            {step.label}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AccountPage({
  initialSection,
  isAuthReady,
  onNavigateCart,
  onNavigateLogin,
  onUserDeleted,
  onUserLoggedOut,
  onUserUpdated,
  sectionRequestKey,
  user,
}: AccountPageProps) {
  const [activeSection, setActiveSection] =
    useState<AccountSection>(initialSection);
  const [profileData, setProfileData] = useState<EditableProfilePayload | null>(
    user ? toEditableProfile(user) : null,
  );
  const [profileState, setProfileState] = useState<AsyncState>({
    status: "idle",
  });
  const [deleteState, setDeleteState] = useState<AsyncState>({
    status: "idle",
  });
  const [logoutState, setLogoutState] = useState<AsyncState>({
    status: "idle",
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [addressData, setAddressData] =
    useState<AddressPayload>(emptyAddressData);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressState, setAddressState] = useState<AsyncState>({
    status: "idle",
  });
  const [orderState, setOrderState] = useState<AsyncState>({
    status: "idle",
  });

  useEffect(() => {
    setProfileData(user ? toEditableProfile(user) : null);
    setAddressData(user ? buildDefaultAddress(user) : emptyAddressData);
    setEditingAddressId(null);
    setIsDeleteDialogOpen(false);
  }, [user]);

  useEffect(() => {
    setActiveSection(initialSection);
    setProfileState({ status: "idle" });
    setDeleteState({ status: "idle" });
    setLogoutState({ status: "idle" });
    setAddressState({ status: "idle" });
    setOrderState({ status: "idle" });
    setIsDeleteDialogOpen(false);
  }, [initialSection, sectionRequestKey]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setAddresses([]);
      setOrders([]);
      return undefined;
    }

    setAddressState({ status: "loading" });
    getAddresses()
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setAddresses(payload.addresses);
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
              : "Não foi possível carregar os endereços.",
          status: "error",
        });
      });

    setOrderState({ status: "loading" });
    getOrders()
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setOrders(payload.orders);
        setOrderState({ status: "idle" });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setOrderState({
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os pedidos.",
          status: "error",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const canSaveProfile = useMemo(() => {
    if (!profileData) {
      return false;
    }

    return (
      profileData.fullName.includes(" ") &&
      profileData.cep.replace(/\D/g, "").length === 8 &&
      profileData.street.trim().length > 0 &&
      profileData.number.trim().length > 0 &&
      profileData.neighborhood.trim().length > 0 &&
      profileData.city.trim().length > 0 &&
      isBrazilianState(profileData.state) &&
      profileData.birthDate.length > 0 &&
      isValidPhone(profileData.phone) &&
      profileState.status !== "loading"
    );
  }, [profileData, profileState.status]);

  const canSaveAddress = useMemo(
    () =>
      addressData.recipientName.trim().length > 2 &&
      addressData.cep.replace(/\D/g, "").length === 8 &&
      addressData.street.trim().length > 0 &&
      addressData.number.trim().length > 0 &&
      addressData.neighborhood.trim().length > 0 &&
      addressData.city.trim().length > 0 &&
      isBrazilianState(addressData.state) &&
      addressState.status !== "loading",
    [addressData, addressState.status],
  );

  const updateProfileField = <Key extends keyof EditableProfilePayload>(
    key: Key,
    value: EditableProfilePayload[Key],
  ) => {
    setProfileData((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
    setProfileState({ status: "idle" });
  };

  const updateAddressField = <Key extends keyof AddressPayload>(
    key: Key,
    value: AddressPayload[Key],
  ) => {
    setAddressData((current) => ({
      ...current,
      [key]: value,
    }));
    setAddressState({ status: "idle" });
  };

  const refreshAddresses = async () => {
    const payload = await getAddresses();
    setAddresses(payload.addresses);
  };

  const refreshOrders = async () => {
    const payload = await getOrders();
    setOrders(payload.orders);
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profileData || !canSaveProfile) {
      setProfileState({
        message: "Revise os dados antes de salvar.",
        status: "error",
      });
      return;
    }

    setProfileState({ status: "loading" });

    try {
      const updatedUser = await updateProfile(profileData);

      if (!updatedUser) {
        throw new Error("Não foi possível atualizar o cadastro.");
      }

      onUserUpdated(updatedUser);
      setProfileState({
        message: "Dados atualizados com sucesso.",
        status: "success",
      });
    } catch (error) {
      setProfileState({
        message:
          error instanceof Error ? error.message : "Falha ao atualizar dados.",
        status: "error",
      });
    }
  };

  const handleDeleteProfile = async () => {
    setDeleteState({ status: "idle" });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteProfile = async () => {
    setDeleteState({ status: "loading" });

    try {
      await deleteProfile();
      setIsDeleteDialogOpen(false);
      onUserDeleted();
    } catch (error) {
      setDeleteState({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir o cadastro.",
        status: "error",
      });
    }
  };

  const handleCloseDeleteDialog = () => {
    if (deleteState.status !== "loading") {
      setIsDeleteDialogOpen(false);
      setDeleteState({ status: "idle" });
    }
  };

  const handleSaveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSaveAddress) {
      setAddressState({
        message: "Revise o endereço antes de salvar.",
        status: "error",
      });
      return;
    }

    setAddressState({ status: "loading" });

    try {
      if (editingAddressId) {
        await updateAddress(editingAddressId, addressData);
      } else {
        await createAddress(addressData);
      }

      await refreshAddresses();
      setAddressData(user ? buildDefaultAddress(user) : emptyAddressData);
      setEditingAddressId(null);
      setAddressState({
        message: "Endereço salvo com sucesso.",
        status: "success",
      });
    } catch (error) {
      setAddressState({
        message:
          error instanceof Error ? error.message : "Falha ao salvar endereço.",
        status: "error",
      });
    }
  };

  const handleEditAddress = (address: AccountAddress) => {
    setEditingAddressId(address.id);
    setAddressData(toAddressPayload(address));
    setAddressState({ status: "idle" });
  };

  const handleCancelAddressEdit = () => {
    setEditingAddressId(null);
    setAddressData(user ? buildDefaultAddress(user) : emptyAddressData);
    setAddressState({ status: "idle" });
  };

  const handleDeleteAddress = async (addressId: string) => {
    setAddressState({ status: "loading" });

    try {
      await deleteAddress(addressId);
      await refreshAddresses();
      setAddressState({
        message: "Endereço excluído.",
        status: "success",
      });
    } catch (error) {
      setAddressState({
        message:
          error instanceof Error ? error.message : "Falha ao excluir endereço.",
        status: "error",
      });
    }
  };

  const handleSetPrimaryAddress = async (addressId: string) => {
    setAddressState({ status: "loading" });

    try {
      await setPrimaryAddress(addressId);
      await refreshAddresses();
      setAddressState({
        message: "Endereço principal atualizado.",
        status: "success",
      });
    } catch (error) {
      setAddressState({
        message:
          error instanceof Error
            ? error.message
            : "Falha ao definir endereço principal.",
        status: "error",
      });
    }
  };

  const handleSectionChange = (section: AccountSection) => {
    setActiveSection(section);
    setProfileState({ status: "idle" });
    setDeleteState({ status: "idle" });
    setLogoutState({ status: "idle" });
    setAddressState({ status: "idle" });
    setOrderState({ status: "idle" });
  };

  const handleLogout = async () => {
    setLogoutState({ status: "loading" });

    try {
      await logout();
      onUserLoggedOut();
    } catch (error) {
      setLogoutState({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível encerrar a sessão.",
        status: "error",
      });
    }
  };

  return (
    <main className="account-page">
      <a className="cart-back-link" href="/carrinho" onClick={onNavigateCart}>
        <ArrowLeft size={18} aria-hidden="true" />
        Voltar
      </a>

      <section className="account-panel" aria-labelledby="account-title">
        {!isAuthReady && (
          <div className="account-empty">
            <p className="eyebrow">Área segura</p>
            <h1 id="account-title">Carregando cadastro</h1>
          </div>
        )}

        {isAuthReady && !user && (
          <div className="account-empty">
            <p className="eyebrow">Minha Conta</p>
            <h1 id="account-title">Entre para acessar sua conta</h1>
            <a
              className="button primary secure-action"
              href="/login"
              onClick={onNavigateLogin}
            >
              Fazer login
            </a>
          </div>
        )}

        {isAuthReady && user && profileData && (
          <>
            <div className="account-heading">
              <div>
                <p className="eyebrow">Minha Conta</p>
                <h1 id="account-title">Olá, {user.fullName.split(" ")[0]}</h1>
                <p>
                  Gerencie seu cadastro, seus endereços de entrega e os pedidos
                  simulados,
                </p>
              </div>
              <button
                className="logout-action"
                type="button"
                onClick={handleLogout}
                disabled={logoutState.status === "loading"}
              >
                <LogOut size={18} aria-hidden="true" />
                {logoutState.status === "loading" ? "Saindo..." : "Encerrar sessão"}
              </button>
            </div>

            <div className="account-section-tabs" role="tablist">
              <button
                className={activeSection === "cadastro" ? "is-selected" : ""}
                type="button"
                role="tab"
                aria-selected={activeSection === "cadastro"}
                onClick={() => handleSectionChange("cadastro")}
              >
                Cadastro
              </button>
              <button
                className={activeSection === "enderecos" ? "is-selected" : ""}
                type="button"
                role="tab"
                aria-selected={activeSection === "enderecos"}
                onClick={() => handleSectionChange("enderecos")}
              >
                Meus Endereços
              </button>
              <button
                className={activeSection === "pedidos" ? "is-selected" : ""}
                type="button"
                role="tab"
                aria-selected={activeSection === "pedidos"}
                onClick={() => {
                  handleSectionChange("pedidos");
                  void refreshOrders();
                }}
              >
                Meus Pedidos
              </button>
            </div>

            {activeSection === "cadastro" && (
              <section className="account-section" aria-label="Cadastro">
                <div className="account-subheading">
                  <h2>Dados do cliente</h2>
                  <p>
                    E-mail, CPF, data de nascimento e senha ficam protegidos e
                    não podem ser alterados nesta área.
                  </p>
                </div>

                <form className="account-form" onSubmit={handleSaveProfile}>
                  <label className="auth-field">
                    <span>E-mail</span>
                    <input value={user.email} disabled readOnly />
                  </label>

                  <label className="auth-field">
                    <span>CPF</span>
                    <input value={user.cpf} disabled readOnly />
                  </label>

                  <label className="auth-field wide">
                    <span>Nome completo</span>
                    <input
                      required
                      value={profileData.fullName}
                      onChange={(event) =>
                        updateProfileField("fullName", event.target.value)
                      }
                    />
                  </label>

                  <label className="auth-field">
                    <span>CEP</span>
                    <input
                      inputMode="numeric"
                      placeholder="00000-000"
                      required
                      value={formatCep(profileData.cep)}
                      onChange={(event) =>
                        updateProfileField("cep", event.target.value)
                      }
                    />
                  </label>

                  <label className="auth-field">
                    <span>Rua</span>
                    <input
                      required
                      value={profileData.street}
                      onChange={(event) =>
                        updateProfileField("street", event.target.value)
                      }
                    />
                  </label>

                  <label className="auth-field">
                    <span>Número</span>
                    <input
                      required
                      value={profileData.number}
                      onChange={(event) =>
                        updateProfileField("number", event.target.value)
                      }
                    />
                  </label>

                  <label className="auth-field">
                    <span>Complemento</span>
                    <input
                      value={profileData.complement}
                      onChange={(event) =>
                        updateProfileField("complement", event.target.value)
                      }
                    />
                  </label>

                  <label className="auth-field">
                    <span>Bairro</span>
                    <input
                      required
                      value={profileData.neighborhood}
                      onChange={(event) =>
                        updateProfileField("neighborhood", event.target.value)
                      }
                    />
                  </label>

                  <label className="auth-field">
                    <span>Cidade</span>
                    <input
                      required
                      value={profileData.city}
                      onChange={(event) =>
                        updateProfileField("city", event.target.value)
                      }
                    />
                  </label>

                  <label className="auth-field">
                    <span>UF</span>
                    <select
                      required
                      value={profileData.state}
                      onChange={(event) =>
                        updateProfileField("state", event.target.value)
                      }
                    >
                      <option value="">Selecione</option>
                      {brazilianStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="auth-field">
                    <span>Data de nascimento</span>
                    <input
                      type="date"
                      value={profileData.birthDate}
                      disabled
                      readOnly
                    />
                  </label>

                  <label className="auth-field">
                    <span>Sexo</span>
                    <select
                      required
                      value={profileData.gender}
                      onChange={(event) =>
                        updateProfileField("gender", event.target.value as Gender)
                      }
                    >
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="nao-binario">Não-binário</option>
                    </select>
                  </label>

                  <label className="auth-field">
                    <span>Celular</span>
                    <input
                      inputMode="tel"
                      placeholder="(21) 99999-9999"
                      required
                      value={profileData.phone}
                      onChange={(event) =>
                        updateProfileField("phone", formatPhone(event.target.value))
                      }
                    />
                  </label>

                  <div className="account-actions">
                    <button
                      className="button primary secure-action"
                      type="submit"
                      disabled={!canSaveProfile}
                    >
                      <Save size={18} aria-hidden="true" />
                      Salvar alterações
                    </button>

                    <button
                      className="danger-action"
                      type="button"
                      onClick={handleDeleteProfile}
                      disabled={deleteState.status === "loading"}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                      Excluir cadastro
                    </button>
                  </div>
                </form>
                <p className="account-support-note">
                  Para alterar sua senha, ou se esqueceu o e-mail cadastrado,
                  entre em contato com nosso{" "}
                  <a href="mailto:lucasmelquiades@outlook.com">Suporte</a>.
                </p>
              </section>
            )}

            {activeSection === "enderecos" && (
              <section className="account-section" aria-label="Meus Endereços">
                <div className="account-subheading">
                  <h2>Meus Endereços</h2>
                  <p>
                    Inclua, altere ou remova endereços e escolha o principal
                    para entrega.
                  </p>
                </div>

                <div className="address-layout">
                  <div className="address-list">
                    {addresses.map((address) => (
                      <article className="address-card" key={address.id}>
                        <div>
                          <span>
                            <MapPin size={18} aria-hidden="true" />
                            {address.label}
                          </span>
                          <h3>{address.recipientName}</h3>
                          <p>
                            {address.street}, {address.number}
                            {address.complement ? ` - ${address.complement}` : ""}
                          </p>
                          <p>
                            {address.neighborhood} - {address.city}/{address.state}
                          </p>
                          <strong>{formatCep(address.cep)}</strong>
                        </div>

                        {address.isPrimary && (
                          <span className="primary-address">
                            <Star size={15} aria-hidden="true" />
                            Principal
                          </span>
                        )}

                        <div className="address-actions">
                          <button
                            type="button"
                            onClick={() => handleEditAddress(address)}
                          >
                            <Edit3 size={16} aria-hidden="true" />
                            Editar
                          </button>
                          {!address.isPrimary && (
                            <button
                              type="button"
                              onClick={() => void handleSetPrimaryAddress(address.id)}
                            >
                              <Home size={16} aria-hidden="true" />
                              Favoritar
                            </button>
                          )}
                          <button
                            className="danger-inline"
                            type="button"
                            onClick={() => void handleDeleteAddress(address.id)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}

                    {addresses.length === 0 && (
                      <p className="account-muted">Nenhum endereço cadastrado.</p>
                    )}
                  </div>

                  <form className="address-form" onSubmit={handleSaveAddress}>
                    <div className="address-form-title">
                      <h3>{editingAddressId ? "Editar endereço" : "Novo endereço"}</h3>
                      {editingAddressId && (
                        <button type="button" onClick={handleCancelAddressEdit}>
                          Cancelar
                        </button>
                      )}
                    </div>

                    <label className="auth-field">
                      <span>Nome do endereço</span>
                      <input
                        placeholder="Casa, trabalho..."
                        value={addressData.label}
                        onChange={(event) =>
                          updateAddressField("label", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>Destinatário</span>
                      <input
                        required
                        value={addressData.recipientName}
                        onChange={(event) =>
                          updateAddressField("recipientName", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>CEP</span>
                      <input
                        inputMode="numeric"
                        placeholder="00000-000"
                        required
                        value={formatCep(addressData.cep)}
                        onChange={(event) =>
                          updateAddressField("cep", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>Rua</span>
                      <input
                        required
                        value={addressData.street}
                        onChange={(event) =>
                          updateAddressField("street", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>Número</span>
                      <input
                        required
                        value={addressData.number}
                        onChange={(event) =>
                          updateAddressField("number", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>Complemento</span>
                      <input
                        value={addressData.complement}
                        onChange={(event) =>
                          updateAddressField("complement", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>Bairro</span>
                      <input
                        required
                        value={addressData.neighborhood}
                        onChange={(event) =>
                          updateAddressField("neighborhood", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>Cidade</span>
                      <input
                        required
                        value={addressData.city}
                        onChange={(event) =>
                          updateAddressField("city", event.target.value)
                        }
                      />
                    </label>

                    <label className="auth-field">
                      <span>UF</span>
                      <select
                        required
                        value={addressData.state}
                        onChange={(event) =>
                          updateAddressField("state", event.target.value)
                        }
                      >
                        <option value="">Selecione</option>
                        {brazilianStates.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="terms-acceptance address-primary-check">
                      <input
                        type="checkbox"
                        checked={Boolean(addressData.isPrimary)}
                        onChange={(event) =>
                          updateAddressField("isPrimary", event.target.checked)
                        }
                      />
                      <span>Definir como endereço principal</span>
                    </label>

                    <button
                      className="button primary secure-action"
                      type="submit"
                      disabled={!canSaveAddress}
                    >
                      <Plus size={18} aria-hidden="true" />
                      {editingAddressId ? "Salvar endereço" : "Adicionar endereço"}
                    </button>
                  </form>
                </div>
              </section>
            )}

            {activeSection === "pedidos" && (
              <section className="account-section" aria-label="Meus Pedidos">
                <div className="account-subheading">
                  <h2>Meus Pedidos</h2>
                  <p>Histórico de pedidos simulados finalizados por este cadastro.</p>
                </div>

                <div className="orders-list">
                  {orderState.status === "loading" && (
                    <p className="account-muted">Carregando pedidos...</p>
                  )}

                  {orders.map((order) => (
                    <article className="order-card" key={order.id}>
                      <header>
                        <div>
                          <span>Pedido</span>
                          <h3>{order.orderCode}</h3>
                        </div>
                        <strong>{formatCurrency(order.totalCents)}</strong>
                      </header>

                      <OrderStatusTimeline status={order.status} />

                      <div className="order-items">
                        {order.items.map((item) => (
                          <div className="order-item" key={item.id}>
                            <img src={item.image} alt={item.productName} />
                            <div>
                              <h4>{item.productName}</h4>
                              <p>
                                {item.colorName} - Quantidade {item.quantity}
                              </p>
                            </div>
                            <strong>
                              {formatCurrency(item.unitPriceCents * item.quantity)}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <dl className="order-details">
                        <div>
                          <dt>Frete</dt>
                          <dd>{formatCurrency(order.shippingPriceCents)}</dd>
                        </div>
                        <div>
                          <dt>Prazo</dt>
                          <dd>
                            {order.shippingCarrier} - {order.shippingEstimate}
                          </dd>
                        </div>
                        <div>
                          <dt>Pagamento</dt>
                          <dd>{order.paymentMethod}</dd>
                        </div>
                        <div>
                          <dt>Entrega</dt>
                          <dd>
                            {order.deliveryAddress.street},{" "}
                            {order.deliveryAddress.number} -{" "}
                            {order.deliveryAddress.city}/
                            {order.deliveryAddress.state}
                          </dd>
                        </div>
                      </dl>

                      <a
                        className="order-tracking-link"
                        href="https://www.lucasmelquiades.dev"
                      >
                        Acompanhar entrega
                      </a>
                    </article>
                  ))}

                  {orderState.status !== "loading" && orders.length === 0 && (
                    <div className="account-empty-state">
                      <PackageCheck size={28} aria-hidden="true" />
                      <p>Nenhum pedido realizado ainda.</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeSection === "cadastro" && profileState.status === "error" && (
              <p className="auth-message error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {profileState.message}
              </p>
            )}

            {activeSection === "cadastro" && profileState.status === "success" && (
              <p className="auth-message success" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                {profileState.message}
              </p>
            )}

            {activeSection === "enderecos" && addressState.status === "error" && (
              <p className="auth-message error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {addressState.message}
              </p>
            )}

            {activeSection === "enderecos" && addressState.status === "success" && (
              <p className="auth-message success" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                {addressState.message}
              </p>
            )}

            {activeSection === "pedidos" && orderState.status === "error" && (
              <p className="auth-message error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {orderState.message}
              </p>
            )}

            {activeSection === "cadastro" && deleteState.status === "error" && (
              <p className="auth-message error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {deleteState.message}
              </p>
            )}

            {logoutState.status === "error" && (
              <p className="auth-message error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {logoutState.message}
              </p>
            )}
          </>
        )}
      </section>

      {isDeleteDialogOpen && (
        <div
          className="account-dialog-backdrop"
          role="presentation"
          onClick={handleCloseDeleteDialog}
        >
          <section
            aria-labelledby="delete-account-title"
            aria-modal="true"
            className="account-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="account-dialog-icon" aria-hidden="true">
              <Trash2 size={24} />
            </span>
            <h2 id="delete-account-title">Excluir conta</h2>
            <p>
              Você tem certeza que deseja excluir sua conta? Esta ação é
              permanente e não afeta pedidos já concluídos.
            </p>

            {deleteState.status === "error" && (
              <p className="auth-message error" role="alert">
                <XCircle size={18} aria-hidden="true" />
                {deleteState.message}
              </p>
            )}

            <div className="account-dialog-actions">
              <button
                className="button secondary"
                type="button"
                onClick={handleCloseDeleteDialog}
                disabled={deleteState.status === "loading"}
              >
                Cancelar
              </button>
              <button
                className="danger-action"
                type="button"
                onClick={() => void handleConfirmDeleteProfile()}
                disabled={deleteState.status === "loading"}
              >
                <Trash2 size={18} aria-hidden="true" />
                {deleteState.status === "loading" ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
