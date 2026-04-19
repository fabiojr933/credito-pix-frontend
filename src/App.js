import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

const api = axios.create({
  baseURL: "http://localhost:3000",
});

function App() {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("PIX");

  const [amount, setAmount] = useState(10);
  const [qrCode, setQrCode] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState("");

  const [card, setCard] = useState({
    number: "",
    holderName: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });

  const [cardStatus, setCardStatus] = useState("FORM");

  const pollingRef = useRef(null);

  // 🔥 FUNÇÃO GENÉRICA DE POLLING
  const startPolling = (url, onSuccess) => {
    clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(url);
        const status = data.data.status;

        if (status === "RECEIVED" || status === "CONFIRMED") {
          clearInterval(pollingRef.current);
          onSuccess();
        }
      } catch (err) {
        console.error("Erro no polling");
      }
    }, 3000);
  };

  // 🔥 PIX
  const createPix = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/pix/create", {
        value: Number(amount),
        description: "teste via api web",
        customer: "cus_000007792771",
      });

      const payment = data.data;

      const { data: qrRes } = await api.get(`/pix/get/${payment.id}`);
      const qr = qrRes.data;

      setQrCode(`data:image/png;base64,${qr.encodedImage}`);
      setPayload(qr.payload);
      setPaymentId(payment.id);

      setStep(2);

      startPolling(`/pix/status/${payment.id}`, () => {
        setStatus("PAID");
      });

    } catch (err) {
      setError("Erro ao gerar pagamento.");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 CARTÃO
  const createCardPayment = async () => {
    setLoading(true);
    setError("");
    setCardStatus("PROCESSING");

    try {
      const { data } = await api.post("/credito/create", {
        value: Number(amount),
        description: "tested",
        customer: "cus_000007792771",
        remoteIp: "168.232.22.65",
      });

      const payment = data.data;

      const { data: payRes } = await api.post(
        `/credito/pagar/${payment.id}`,
        {
          holderName: card.holderName,
          number: card.number,
          expiryMonth: String(card.expiryMonth),
          expiryYear: String(card.expiryYear),
          ccv: String(card.ccv),
          "name": card.holderName,
          "email": "fabio@gmail.com",
          "cpfCnpj": "04870537109",
          "postalCode": "78520000",
          "addressNumber": "6699539490",
          "phone": "66999539490"
        }
      );

      const result = payRes.data;

      startPolling(`/credito/status/${result.id}`, () => {
        setCardStatus("APPROVED");
      });

    } catch (err) {
      console.error(err);
      setCardStatus("FAILED");
      setError("Pagamento recusado");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 INPUT HANDLER
  const handleCardChange = (field, value) => {
    setCard((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 🟡 PROCESSANDO
  if (cardStatus === "PROCESSING") {
    return (
      <div className="container">
        <div className="card center">
          <div className="loader"></div>
          <h2>Processando pagamento...</h2>
        </div>
      </div>
    );
  }

  // 🟢 APROVADO
  if (cardStatus === "APPROVED") {
    return (
      <div className="container">
        <div className="card center">
          <h1 className="success">✅</h1>
          <h2>Pagamento aprovado!</h2>
          <button onClick={() => window.location.reload()} className="button">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // 🔴 RECUSADO
  if (cardStatus === "FAILED") {
    return (
      <div className="container">
        <div className="card center">
          <h1 className="error-icon">❌</h1>
          <h2>Pagamento recusado</h2>
          <button onClick={() => setCardStatus("FORM")} className="button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // 🟣 TELA INICIAL
  if (step === 1) {
    return (
      <div className="container">
        <div className="card">
          <h2>Checkout</h2>

          <div className="tabs">
            <button
              className={method === "PIX" ? "tab active" : "tab"}
              onClick={() => setMethod("PIX")}
            >
              Pix
            </button>

            <button
              className={method === "CARD" ? "tab active" : "tab"}
              onClick={() => setMethod("CARD")}
            >
              Cartão
            </button>
          </div>

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="input"
          />

          <p className="price">R$ {amount.toFixed(2)}</p>

          {method === "PIX" && (
            <button onClick={createPix} className="button">
              {loading ? "Gerando..." : "Pagar com Pix"}
            </button>
          )}

          {method === "CARD" && (
            <>
              <input
                placeholder="Número"
                className="input"
                onChange={(e) =>
                  handleCardChange("number", e.target.value)
                }
              />
              <input
                placeholder="Nome"
                className="input"
                onChange={(e) =>
                  handleCardChange("holderName", e.target.value)
                }
              />
              <input
                placeholder="MM"
                className="input"
                onChange={(e) =>
                  handleCardChange("expiryMonth", e.target.value)
                }
              />
              <input
                placeholder="AA"
                className="input"
                onChange={(e) =>
                  handleCardChange("expiryYear", e.target.value)
                }
              />
              <input
                placeholder="CVV"
                className="input"
                onChange={(e) =>
                  handleCardChange("ccv", e.target.value)
                }
              />

              <button onClick={createCardPayment} className="button">
                Pagar com Cartão
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 🟢 PIX RESULTADO
  return (
    <div className="container">
      <div className="split">
        <div className="left">
          <h2>Pagamento Pix</h2>
          <p>ID: {paymentId}</p>

          <h1 className="price">R$ {amount.toFixed(2)}</h1>

          <div className={`status ${status === "PAID" ? "paid" : ""}`}>
            {status === "PAID"
              ? "Pagamento confirmado"
              : "Aguardando pagamento"}
          </div>

          <textarea readOnly value={payload} className="pix-textarea" />

          <button
            onClick={() => navigator.clipboard.writeText(payload)}
            className="button"
          >
            Copiar Pix
          </button>
        </div>

        <div className="right">
          <div className="qr-container">
            <img src={qrCode} alt="QR" className="qrcode" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
