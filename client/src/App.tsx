import { useState } from "react";
import axios from "axios";

type TestResult = {
  name: string;
  pass: boolean;
  p?: number;
};

type ResponseData = {
  generatedKey?: string;
  key?: string;
  tests?: TestResult[];
  summary?: string;
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);

  const uploadImage = async () => {
    if (!file) return alert("Choose an image");

    const formData = new FormData();
    formData.append("image", file);

    try {
      setLoading(true);

      const res = await axios.post<ResponseData>(
        "http://localhost:5000/api/keys/upload",
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
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">

          <h2 className="text-2xl font-semibold mb-6">
            Generated Key
          </h2>

          <div className="bg-black/40 rounded-2xl p-5 min-h-[180px] break-all text-green-400 text-sm font-mono leading-7 border border-zinc-800">

            {data?.generatedKey ||
             data?.key ||
             "Waiting for image upload..."}

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

          {/* Debug Panel */}
          <div className="mt-8 bg-black/40 rounded-2xl p-4 text-xs text-zinc-400 overflow-auto">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>

        </div>
      )}

    </div>
  );
}

export default App;