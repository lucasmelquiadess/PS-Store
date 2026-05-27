import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEventHandler,
} from "react";
import { getShippingQuote } from "../lib/commerceApi";
import {
  forgotPassword,
  login,
  recoverEmailByCpf,
  register,
  type AuthUser,
  type Gender,
  type RegisterPayload,
} from "../lib/authApi";
import { officialLinks } from "../data/product";

type LoginPageProps = {
  onAuthenticated: (user: AuthUser) => void;
  onNavigateCart: MouseEventHandler<HTMLAnchorElement>;
};

type AuthMode = "login" | "register";
type RecoveryMode = "password" | "email";
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
const emailPattern = /^[^\s@]+@[^\s@]+\.com(?:\.br)?$/i;
const phonePattern = /^\(\d{2}\) 9\d{4}-\d{4}$/;
const passwordRequirementsMessage =
  "A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.";

const initialRegisterData: RegisterPayload = {
  acceptedTerms: false,
  birthDate: "",
  cep: "",
  city: "",
  complement: "",
  confirmPassword: "",
  cpf: "",
  email: "",
  fullName: "",
  gender: "masculino",
  neighborhood: "",
  number: "",
  password: "",
  phone: "",
  state: "",
  street: "",
};

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
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

function isCpfFormatComplete(value: string) {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value);
}

function hasCompleteCpfDigits(value: string) {
  return value.replace(/\D/g, "").length === 11;
}

function isValidCpf(value: string) {
  if (!isCpfFormatComplete(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (factor: number) => {
    let total = 0;

    for (let index = 0; index < factor - 1; index += 1) {
      total += Number(digits[index]) * (factor - index);
    }

    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(10) === Number(digits[9]) &&
    calculateDigit(11) === Number(digits[10])
  );
}

function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}

function isValidPhoneFormat(value: string) {
  return phonePattern.test(value);
}

function getPasswordStrength(password: string) {
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z\d]/.test(password);
  const meetsMinimum =
    password.length >= 8 && hasUppercase && hasNumber && hasSpecial;

  if (password.length >= 12 && hasLowercase && meetsMinimum) {
    return "forte";
  }

  if (meetsMinimum) {
    return "moderada";
  }

  return "fraca";
}

export function LoginPage({
  onAuthenticated,
  onNavigateCart,
}: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState(initialRegisterData);
  const [forgotEmail, setForgotEmail] = useState("");
  const [recoveryCpf, setRecoveryCpf] = useState("");
  const [recoveredEmail, setRecoveredEmail] = useState("");
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>("password");
  const [showPasswords, setShowPasswords] = useState(false);
  const [authState, setAuthState] = useState<AsyncState>({ status: "idle" });
  const [recoveryState, setRecoveryState] = useState<AsyncState>({
    status: "idle",
  });
  const [cepState, setCepState] = useState<AsyncState>({ status: "idle" });

  const cleanCep = registerData.cep.replace(/\D/g, "");
  const passwordStrength = useMemo(
    () => getPasswordStrength(registerData.password),
    [registerData.password],
  );
  const isLoginEmailInvalid =
    loginData.email.length > 0 && !isValidEmail(loginData.email);
  const isRecoveryEmailInvalid =
    forgotEmail.length > 0 && !isValidEmail(forgotEmail);
  const isRecoveryCpfInvalid =
    hasCompleteCpfDigits(recoveryCpf) && !isValidCpf(recoveryCpf);
  const isRegisterEmailInvalid =
    registerData.email.length > 0 && !isValidEmail(registerData.email);
  const isCpfInvalid =
    hasCompleteCpfDigits(registerData.cpf) && !isValidCpf(registerData.cpf);
  const isPhoneInvalid =
    registerData.phone.length > 0 &&
    !isValidPhoneFormat(registerData.phone);
  const isWeakPassword =
    registerData.password.length > 0 && passwordStrength === "fraca";
  const passwordsMatch =
    registerData.password.length > 0 &&
    registerData.password === registerData.confirmPassword;
  const hasValidRegisterFields =
    isValidEmail(registerData.email) &&
    isValidPhoneFormat(registerData.phone) &&
    passwordStrength !== "fraca" &&
    passwordsMatch &&
    isValidCpf(registerData.cpf) &&
    brazilianStates.includes(
      registerData.state as (typeof brazilianStates)[number],
    ) &&
    cleanCep.length === 8;
  const canRegister =
    hasValidRegisterFields &&
    registerData.acceptedTerms &&
    authState.status !== "loading";

  useEffect(() => {
    if (cleanCep.length === 0) {
      setCepState({ status: "idle" });
      return undefined;
    }

    if (cleanCep.length < 8) {
      setCepState({ status: "idle" });
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCepState({ status: "loading" });
      getShippingQuote(cleanCep, controller.signal)
        .then((quote) => {
          setRegisterData((current) => ({
            ...current,
            city: quote.address.city,
            neighborhood: quote.address.neighborhood,
            state: quote.address.state,
            street: quote.address.street,
          }));
          setCepState({ status: "idle" });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          setCepState({
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

  const updateRegisterField = (key: keyof RegisterPayload, value: string) => {
    setRegisterData((current) => ({
      ...current,
      [key]: value,
    }));
    setAuthState({ status: "idle" });
  };

  const openRecoveryModal = () => {
    setForgotEmail(loginData.email);
    setRecoveryCpf("");
    setRecoveredEmail("");
    setRecoveryMode("password");
    setRecoveryState({ status: "idle" });
    setAuthState({ status: "idle" });
    setIsRecoveryOpen(true);
  };

  const closeRecoveryModal = () => {
    setIsRecoveryOpen(false);
    setRecoveryState({ status: "idle" });
  };

  const showEmailRecovery = () => {
    setRecoveryMode("email");
    setRecoveredEmail("");
    setRecoveryState({ status: "idle" });
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidEmail(loginData.email)) {
      setAuthState({
        message: "Digite um e-mail válido.",
        status: "error",
      });
      return;
    }

    setAuthState({ status: "loading" });

    try {
      const user = await login(loginData);

      if (!user) {
        throw new Error("Não foi possível iniciar a sessão.");
      }

      onAuthenticated(user);
    } catch (error) {
      setAuthState({
        message: error instanceof Error ? error.message : "Falha no login.",
        status: "error",
      });
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasValidRegisterFields) {
      setAuthState({
        message: "Revise e-mail, CPF, celular, CEP e senha antes de concluir.",
        status: "error",
      });
      return;
    }

    if (!registerData.acceptedTerms) {
      setAuthState({
        message: "Você deve ler e aceitar os Termos de Uso.",
        status: "error",
      });
      return;
    }

    setAuthState({ status: "loading" });

    try {
      const user = await register(registerData);

      if (!user) {
        throw new Error("Não foi possível concluir o cadastro.");
      }

      onAuthenticated(user);
    } catch (error) {
      setAuthState({
        message:
          error instanceof Error ? error.message : "Falha ao concluir cadastro.",
        status: "error",
      });
    }
  };

  const handleForgotPassword = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!isValidEmail(forgotEmail)) {
      setRecoveryState({
        message: "Digite um e-mail válido.",
        status: "error",
      });
      return;
    }

    setRecoveryState({ status: "loading" });

    try {
      const result = await forgotPassword(forgotEmail);
      setRecoveryState({ message: result.message, status: "success" });
    } catch (error) {
      setRecoveryState({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível processar a solicitação.",
        status: "error",
      });
    }
  };

  const handleRecoverEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveredEmail("");

    if (!isValidCpf(recoveryCpf)) {
      setRecoveryState({
        message: "Insira um CPF válido no formato 000.000.000-00.",
        status: "error",
      });
      return;
    }

    setRecoveryState({ status: "loading" });

    try {
      const result = await recoverEmailByCpf(recoveryCpf);
      setRecoveredEmail(result.email);
      setRecoveryState({
        message: "E-mail cadastrado encontrado.",
        status: "success",
      });
    } catch (error) {
      setRecoveryState({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível localizar o cadastro.",
        status: "error",
      });
    }
  };

  const passwordInputType = showPasswords ? "text" : "password";

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="auth-title">
        <a className="cart-back-link" href="/carrinho" onClick={onNavigateCart}>
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar ao carrinho
        </a>

        <div className="auth-heading">
          <p className="eyebrow">Área segura</p>
          <h1 id="auth-title">Entre para continuar</h1>
        </div>

        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Acesso seguro">
            <button
              className={mode === "login" ? "is-selected" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setAuthState({ status: "idle" });
              }}
            >
              Entrar
            </button>
            <button
              className={mode === "register" ? "is-selected" : ""}
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => {
                setMode("register");
                setAuthState({ status: "idle" });
              }}
            >
              Criar conta
            </button>
          </div>

          {mode === "login" && (
            <form className="auth-form" onSubmit={handleLogin}>
              <label className="auth-field">
                <span>E-mail</span>
                <div>
                  <Mail size={18} aria-hidden="true" />
                  <input
                    autoComplete="email"
                    aria-invalid={isLoginEmailInvalid}
                    inputMode="email"
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(event) =>
                      setLoginData((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>
              {isLoginEmailInvalid && (
                <p className="auth-inline-error">Digite um e-mail válido.</p>
              )}

              <label className="auth-field">
                <span>Senha</span>
                <div>
                  <Lock size={18} aria-hidden="true" />
                  <input
                    autoComplete="current-password"
                    type={passwordInputType}
                    required
                    value={loginData.password}
                    onChange={(event) =>
                      setLoginData((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPasswords((current) => !current)}
                    aria-label={showPasswords ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPasswords ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>

              <button
                className="button primary secure-action"
                type="submit"
                disabled={authState.status === "loading"}
              >
                <LogIn size={18} aria-hidden="true" />
                Entrar
              </button>

              <button
                className="forgot-link"
                type="button"
                onClick={openRecoveryModal}
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {mode === "register" && (
            <form className="auth-form register-form" onSubmit={handleRegister}>
              <label className="auth-field wide">
                <span>Nome completo</span>
                <input
                  autoComplete="name"
                  required
                  value={registerData.fullName}
                  onChange={(event) =>
                    updateRegisterField("fullName", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>E-mail</span>
                <input
                  autoComplete="email"
                  aria-invalid={isRegisterEmailInvalid}
                  inputMode="email"
                  type="email"
                  required
                  value={registerData.email}
                  onChange={(event) =>
                    updateRegisterField("email", event.target.value)
                  }
                />
              </label>
              {isRegisterEmailInvalid && (
                <p className="auth-inline-error">Digite um e-mail válido.</p>
              )}

              <label className="auth-field">
                <span>CPF</span>
                <input
                  aria-invalid={isCpfInvalid}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  required
                  value={registerData.cpf}
                  onChange={(event) =>
                    updateRegisterField("cpf", formatCpf(event.target.value))
                  }
                />
              </label>
              {isCpfInvalid && (
                <p className="auth-inline-error cpf-field-message">
                  Insira um CPF válido.
                </p>
              )}
              {registerData.cpf.length > 0 && isValidCpf(registerData.cpf) && (
                <p className="auth-inline-status success cpf-field-message">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  CPF validado com segurança.
                </p>
              )}

              <label className="auth-field">
                <span>CEP</span>
                <input
                  inputMode="numeric"
                  placeholder="00000-000"
                  required
                  value={formatCep(registerData.cep)}
                  onChange={(event) =>
                    updateRegisterField("cep", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>Rua</span>
                <input
                  autoComplete="address-line1"
                  required
                  value={registerData.street}
                  onChange={(event) =>
                    updateRegisterField("street", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>Número</span>
                <input
                  autoComplete="address-line2"
                  required
                  value={registerData.number}
                  onChange={(event) =>
                    updateRegisterField("number", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>Complemento</span>
                <input
                  value={registerData.complement}
                  onChange={(event) =>
                    updateRegisterField("complement", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>Bairro</span>
                <input
                  required
                  value={registerData.neighborhood}
                  onChange={(event) =>
                    updateRegisterField("neighborhood", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>Cidade</span>
                <input
                  autoComplete="address-level2"
                  required
                  value={registerData.city}
                  onChange={(event) =>
                    updateRegisterField("city", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>UF</span>
                <select
                  autoComplete="address-level1"
                  required
                  value={registerData.state}
                  onChange={(event) =>
                    updateRegisterField("state", event.target.value)
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
                  required
                  value={registerData.birthDate}
                  onChange={(event) =>
                    updateRegisterField("birthDate", event.target.value)
                  }
                />
              </label>

              <label className="auth-field">
                <span>Sexo</span>
                <select
                  required
                  value={registerData.gender}
                  onChange={(event) =>
                    updateRegisterField("gender", event.target.value as Gender)
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
                  aria-invalid={isPhoneInvalid}
                  autoComplete="tel-national"
                  inputMode="tel"
                  placeholder="(21) 99999-9999"
                  required
                  value={registerData.phone}
                  onChange={(event) =>
                    updateRegisterField("phone", formatPhone(event.target.value))
                  }
                />
              </label>
              {isPhoneInvalid && (
                <p className="auth-inline-error">
                  Insira um celular válido no formato (21) 99999-9999.
                </p>
              )}

              <label className="auth-field">
                <span>Senha</span>
                <div>
                  <Lock size={18} aria-hidden="true" />
                  <input
                    autoComplete="new-password"
                    type={passwordInputType}
                    required
                    value={registerData.password}
                    onChange={(event) =>
                      updateRegisterField("password", event.target.value)
                    }
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPasswords((current) => !current)}
                    aria-label={showPasswords ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPasswords ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </label>

              <label className="auth-field">
                <span>Confirmar senha</span>
                <div>
                  <Lock size={18} aria-hidden="true" />
                  <input
                    autoComplete="new-password"
                    type={passwordInputType}
                    required
                    value={registerData.confirmPassword}
                    onChange={(event) =>
                      updateRegisterField("confirmPassword", event.target.value)
                    }
                  />
                </div>
              </label>

              <div className={`password-strength is-${passwordStrength}`}>
                <span>Senha {passwordStrength}</span>
                <strong aria-hidden="true" />
              </div>

              {isWeakPassword && (
                <p className="auth-inline-error">
                  {passwordRequirementsMessage}
                </p>
              )}

              {registerData.confirmPassword && !passwordsMatch && (
                <p className="auth-inline-error">As senhas não conferem.</p>
              )}

              <label className="terms-acceptance">
                <input
                  type="checkbox"
                  checked={registerData.acceptedTerms}
                  onChange={(event) => {
                    setRegisterData((current) => ({
                      ...current,
                      acceptedTerms: event.target.checked,
                    }));
                    setAuthState({ status: "idle" });
                  }}
                />
                <span>
                  Li e aceito os{" "}
                  <a
                    href={officialLinks.playstation}
                    target="_blank"
                    rel="noreferrer"
                  >
                    termos de uso
                  </a>{" "}
                  do site.
                </span>
              </label>

              {cepState.status === "loading" && (
                <p className="auth-inline-status">Validando CEP...</p>
              )}
              {cepState.status === "error" && (
                <p className="auth-inline-status error">
                  <XCircle size={16} aria-hidden="true" />
                  {cepState.message}
                </p>
              )}

              <button
                className="button primary secure-action wide"
                type="submit"
                disabled={!hasValidRegisterFields || authState.status === "loading"}
              >
                <UserPlus size={18} aria-hidden="true" />
                Concluir cadastro
              </button>
            </form>
          )}

          {authState.status === "error" && (
            <p className="auth-message error" role="alert">
              <XCircle size={18} aria-hidden="true" />
              {authState.message}
            </p>
          )}

          {authState.status === "success" && (
            <p className="auth-message success" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              {authState.message}
            </p>
          )}
        </div>

        {isRecoveryOpen && (
          <div
            className="auth-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeRecoveryModal();
              }
            }}
          >
            <section
              className="auth-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recovery-title"
            >
              <button
                className="auth-modal-close"
                type="button"
                onClick={closeRecoveryModal}
                aria-label="Fechar recuperação de senha"
              >
                <X size={18} aria-hidden="true" />
              </button>

              <p className="eyebrow">Área segura</p>
              <h2 id="recovery-title">Redefina sua senha</h2>

              {recoveryMode === "password" ? (
                <form className="auth-form recovery-form" onSubmit={handleForgotPassword}>
                  <label className="auth-field">
                    <span>E-mail cadastrado</span>
                    <div>
                      <Mail size={18} aria-hidden="true" />
                      <input
                        autoComplete="email"
                        aria-invalid={isRecoveryEmailInvalid}
                        inputMode="email"
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(event) => {
                          setForgotEmail(event.target.value);
                          setRecoveryState({ status: "idle" });
                        }}
                      />
                    </div>
                  </label>
                  {isRecoveryEmailInvalid && (
                    <p className="auth-inline-error">Digite um e-mail válido.</p>
                  )}

                  <button
                    className="button primary secure-action wide"
                    type="submit"
                    disabled={recoveryState.status === "loading"}
                  >
                    Redefinir senha
                  </button>

                  <button
                    className="forgot-link recovery-switch"
                    type="button"
                    onClick={showEmailRecovery}
                  >
                    Esqueci o e-mail cadastrado
                  </button>
                </form>
              ) : (
                <form className="auth-form recovery-form" onSubmit={handleRecoverEmail}>
                  <label className="auth-field">
                    <span>CPF</span>
                    <input
                      aria-invalid={isRecoveryCpfInvalid}
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      required
                      value={recoveryCpf}
                      onChange={(event) => {
                        setRecoveryCpf(formatCpf(event.target.value));
                        setRecoveredEmail("");
                        setRecoveryState({ status: "idle" });
                      }}
                    />
                  </label>
                  {isRecoveryCpfInvalid && (
                    <p className="auth-inline-error">
                      Insira um CPF válido no formato 000.000.000-00.
                    </p>
                  )}

                  <button
                    className="button primary secure-action wide"
                    type="submit"
                    disabled={recoveryState.status === "loading"}
                  >
                    Localizar e-mail
                  </button>

                  <button
                    className="forgot-link recovery-switch"
                    type="button"
                    onClick={() => {
                      setRecoveryMode("password");
                      setRecoveredEmail("");
                      setRecoveryState({ status: "idle" });
                    }}
                  >
                    Voltar para redefinir senha
                  </button>
                </form>
              )}

              {recoveredEmail && (
                <p className="recovered-email">
                  E-mail cadastrado
                  <strong>{recoveredEmail}</strong>
                </p>
              )}

              {recoveryState.status === "error" && (
                <p className="auth-message error" role="alert">
                  <XCircle size={18} aria-hidden="true" />
                  {recoveryState.message}
                </p>
              )}

              {recoveryState.status === "success" && (
                <p className="auth-message success" role="status">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {recoveryState.message}
                </p>
              )}

              <p className="support-note">
                Caso não possua acesso ao e-mail cadastrado, entre em contato
                com nosso suporte em lucasmelquiades.dev@gmai.com,{" "}
                <a href="mailto:lucasmelquiades.dev@gmai.com">clicando aqui</a>.
              </p>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
