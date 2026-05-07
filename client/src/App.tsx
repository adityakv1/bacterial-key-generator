import { useState } from "react";
import axios from "axios";

type TestResult = {
  name: string;
  pass: boolean;
  p?: number;
};

type ResponseData = {
  bitKey?: string;
  hexKey?: string;
  tests?: TestResult[];
  summary?: string;
  visualization?: string;
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState<"1" | "2">("1");
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);

  // AES States
  const [aesText, setAesText] = useState("");
  const [encryptedData, setEncryptedData] = useState("");
  const [decryptedResult, setDecryptedResult] = useState("");
  const [aesVis, setAesVis] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptKeyInput, setDecryptKeyInput] = useState("");

  const uploadImage = async () => {
    if (!file) return alert("Choose an image");

    const formData = new FormData();
    formData.append("image", file);
    formData.append("method", method);

    try {
      setLoading(true);

const res = await axios.post<ResponseData>(
  "https://bacterial-key.onrender.com/api/keys/upload",
  formData
);

      console.log("BACKEND RESPONSE:", res.data);

      setData(res.data);

    } catch (error: any) {
      console.log(error);

      alert(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        "Upload failed"
      );
    }

    setLoading(false);
  };

  const encryptAction = async () => {
    if (!data?.hexKey) return alert("Generate a key first!");
    if (!aesText) return alert("Enter some text to encrypt");

    try {
      setEncrypting(true);
      const res = await axios.post("https://bacterial-key.onrender.com/api/keys/encrypt", {
        key: data.hexKey,
        text: aesText
      });
      setEncryptedData(res.data.encrypted);
      setAesVis(res.data.visualization);
    } catch (error: any) {
      alert("Encryption failed: " + error.message);
    }
    setEncrypting(false);
  };

  const decryptAction = async () => {
    if (!decryptKeyInput) return alert("Please enter a decryption key");
    if (!encryptedData) return alert("No encrypted data found");

    try {
      setDecrypting(true);
      const res = await axios.post("https://bacterial-key.onrender.com/api/keys/decrypt", {
        key: decryptKeyInput,
        encrypted: encryptedData
      });
      setDecryptedResult(res.data.decrypted);
    } catch (error: any) {
      alert("Decryption failed! The key is likely incorrect.");
    }
    setDecrypting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-white px-6 py-10">

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
          Bacterial Key Generator
        </h1>

        <p className="text-zinc-400 mt-3 text-lg">
          AI-powered entropy extraction using bacterial images
        </p>
      </div>

      {/* Top Cards */}
      <div className="grid md:grid-cols-2 gap-8">

        {/* Upload Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">

          <h2 className="text-2xl font-semibold mb-6">
            Upload Bacterial Image
          </h2>

          <div className="mb-6 flex space-x-2 bg-black/40 p-1 rounded-xl">
            <button
              onClick={() => setMethod("1")}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${method === "1" ? "bg-cyan-500 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Method 1 (Colonies)
            </button>
            <button
              onClick={() => setMethod("2")}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${method === "2" ? "bg-cyan-500 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Method 2 (Features)
            </button>
          </div>

          <label className="border-2 border-dashed border-zinc-600 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400 transition">

            <span className="text-zinc-400 mb-2">
              Click to choose image
            </span>

            <input
              type="file"
              className="hidden"
              onChange={(e) =>
                setFile(e.target.files ? e.target.files[0] : null)
              }
            />

            {file && (
              <span className="text-cyan-400 mt-2 text-sm">
                {file.name}
              </span>
            )}
          </label>

          <button
            onClick={uploadImage}
            className="mt-6 w-full bg-cyan-500 hover:bg-cyan-600 transition py-3 rounded-2xl font-semibold"
          >
            {loading ? "Generating..." : "Generate Secure Key"}
          </button>

        </div>

        {/* Key Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col gap-6">

          <div>
            <h2 className="text-xl font-semibold mb-3">
              Generated Key (Binary 256-bit)
            </h2>
            <div className="bg-black/40 rounded-2xl p-5 min-h-[140px] break-all text-green-400 text-sm font-mono leading-7 border border-zinc-800">
              {data?.bitKey || "Waiting for image upload..."}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">
              Generated Key (Hex SHA-256)
            </h2>
            <div className="bg-black/40 rounded-2xl p-5 min-h-[80px] break-all text-cyan-400 text-sm font-mono leading-7 border border-zinc-800">
              {data?.hexKey || "Waiting for image upload..."}
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Section */}
      {data && data.tests && (
        <div className="mt-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">

          <h2 className="text-2xl font-semibold mb-6">
            NIST Randomness Analysis
          </h2>

          <div className="grid md:grid-cols-3 gap-4">

            {data.tests.map((test, index) => (
              <div
                key={index}
                className="bg-black/30 border border-zinc-800 rounded-2xl p-5"
              >
                <h3 className="font-semibold text-lg">
                  {test.name}
                </h3>

                <p
                  className={`mt-3 text-lg font-bold ${
                    test.pass
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {test.pass ? "PASS" : "FAIL"}
                </p>

                {test.p !== undefined && (
                  <p className="text-zinc-400 text-sm mt-1">
                    p-value: {test.p}
                  </p>
                )}
              </div>
            ))}

          </div>

          {/* Summary */}
          <div className="mt-8 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-6">

            <h3 className="text-xl font-semibold text-cyan-300 mb-3">
              AI Interpretation
            </h3>

            <p className="text-zinc-200 leading-7">
              {data.summary || "No summary available"}
            </p>

          </div>

          {/* Visualization */}
          {data.visualization && (
            <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-cyan-300 mb-4">
                Feature Visualization
              </h3>
              <img 
                src={`data:image/png;base64,${data.visualization}`} 
                alt="Feature Extraction Grid" 
                className="w-full rounded-xl object-contain bg-white"
              />
            </div>
          )}

        </div>
      )}

      {/* AES Section */}
      {data && (
        <div className="mt-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
            Cryptographic Sandbox (AES-256)
          </h2>

          <div className="grid md:grid-cols-2 gap-10">
            {/* Input & Encrypt */}
            <div className="space-y-6">
              <div>
                <label className="block text-zinc-400 mb-2 font-medium">Input Data (Text)</label>
                <textarea
                  className="w-full bg-black/40 border border-zinc-700 rounded-2xl p-4 text-zinc-200 focus:border-purple-500 outline-none transition min-h-[120px]"
                  placeholder="Type a message to encrypt with your bacterial key..."
                  value={aesText}
                  onChange={(e) => setAesText(e.target.value)}
                />
              </div>

              <button
                onClick={encryptAction}
                disabled={encrypting}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-90 transition rounded-2xl font-bold text-lg shadow-lg shadow-purple-500/20"
              >
                {encrypting ? "Encrypting..." : "🔒 Encrypt with Bacterial Key"}
              </button>

              {encryptedData && (
                <div className="mt-6">
                  <label className="block text-zinc-400 mb-2 font-medium">Ciphertext (Base64)</label>
                  <div className="bg-black/60 border border-zinc-800 p-4 rounded-2xl break-all text-xs font-mono text-purple-300">
                    {encryptedData}
                  </div>
                </div>
              )}
            </div>

            {/* Visualize & Decrypt */}
            <div className="space-y-6">
              {aesVis ? (
                <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-zinc-500 mb-3 uppercase tracking-wider">Avalanche Effect Visualization</h3>
                  <img src={`data:image/png;base64,${aesVis}`} alt="AES Visualization" className="w-full rounded-lg" />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
                  Encrypt to see bit-level distribution
                </div>
              )}

              {encryptedData && (
                <div className="pt-6 border-t border-zinc-800">
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-zinc-400 font-medium">Decryption Key (Hex)</label>
                      <button 
                        onClick={() => setDecryptKeyInput(data?.hexKey || "")}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        Auto-fill Bacterial Key
                      </button>
                    </div>
                    <input
                      type="text"
                      className="w-full bg-black/40 border border-zinc-700 rounded-xl p-3 text-xs font-mono text-zinc-300 focus:border-purple-500 outline-none"
                      placeholder="Enter the 64-char hex key..."
                      value={decryptKeyInput}
                      onChange={(e) => setDecryptKeyInput(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={decryptAction}
                    disabled={decrypting}
                    className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 transition rounded-2xl font-bold text-lg"
                  >
                    {decrypting ? "Decrypting..." : "🔓 Decrypt Result"}
                  </button>

                  {decryptedResult && (
                    <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                      <p className="text-zinc-400 text-sm mb-1 font-medium">Decrypted Message:</p>
                      <p className="text-xl text-green-400 font-semibold">{decryptedResult}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;