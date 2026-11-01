import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { API } from "../config.js";
const presets = [200, 500, 1000, 2000, 5000];

function Wallet({ token, balance, setBalance }) {
  const [amount, setAmount] = useState(200);
  const [payment, setPayment] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | waiting | done | error

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  async function startPayment() {
    try {
      const res = await fetch(`${API}/api/payments`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setPayment({ id: data.id, amount });
      setStatus("waiting");
    } catch {
      setStatus("error");
    }
  }

  // While waiting, ask the server every 1.5s if the QR was scanned
  useEffect(() => {
    if (status !== "waiting" || !payment) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/payments/${payment.id}`);
        const data = await res.json();
        if (data.status === "paid") {
          clearInterval(timer);
          const claim = await fetch(`${API}/api/payments/${payment.id}/claim`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          const result = await claim.json();
          if (result.ok) setBalance(result.balance);
          setStatus("done");
        }
      } catch {
        // server hiccup, just try again on the next tick
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [status, payment, token, setBalance]);

  return (
    <div className="app">
      <h1>Wallet</h1>

      <div className="wallet-balance">
        <span>Available balance</span>
        <strong>₹{balance.toFixed(2)}</strong>
      </div>

      <div className="wallet-card">
        <h3>Add money</h3>

        {status === "idle" && (
          <>
            <div className="network-note">
              <strong>Demo tip:</strong> Make sure your PC and mobile are
              connected to the same network (Wi-Fi) before paying, otherwise
              the QR won't open on your phone.
            </div>

            <div className="presets">
              {presets.map((p) => (
                <button
                  key={p}
                  className={amount === p ? "tab active" : "tab"}
                  onClick={() => setAmount(p)}
                >
                  ₹{p}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <button
              className="primary-btn"
              onClick={startPayment}
              disabled={!(amount > 0)}
            >
              Pay ₹{amount || 0} via UPI
            </button>
          </>
        )}

        {status === "waiting" && (
          <div className="qr-box">
            <QRCodeSVG value={`${API}/scan/${payment.id}`} size={200} />
            <p>Scan with your phone to pay ₹{payment.amount}</p>
            <p className="note-small">Waiting for payment...</p>
            <p className="network-note small">
              Phone not opening the link? Check that it's on the same
              Wi-Fi as this PC.
            </p>
            <button className="tab" onClick={() => setStatus("idle")}>
              Cancel
            </button>
          </div>
        )}

        {status === "done" && (
          <div className="qr-box">
            <p className="up big-msg">✓ Payment received</p>
            <p className="note-small">The money has been added to your wallet.</p>
            <button className="primary-btn" onClick={() => setStatus("idle")}>
              Add more
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="qr-box">
            <p className="down">Can't reach the payment server.</p>
            <p className="note-small">
              Is `node server/index.js` running in a second terminal?
            </p>
            <button className="tab" onClick={() => setStatus("idle")}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Wallet;