from flask import Flask, request, jsonify
import os
import cv2
import numpy as np
import hashlib
import time
import struct
import math

from scipy.special import gammaincc
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

app = Flask(__name__)


# =====================================================
# STEP 1 : PREPROCESS
# =====================================================
def preprocess(path):

    img = cv2.imread(path)

    if img is None:
        raise ValueError("Image not found")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    gray = cv2.equalizeHist(gray)

    blur = cv2.GaussianBlur(gray, (9, 9), 2)

    binary = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        15,
        4
    )

    kernel = np.ones((3, 3), np.uint8)

    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    return gray, binary


# =====================================================
# STEP 2 : DETECT COLONIES
# =====================================================
def detect_colonies(binary):

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)

    colonies = []

    for i in range(1, num_labels):

        area = stats[i, cv2.CC_STAT_AREA]

        if area < 20:
            continue

        cx, cy = centroids[i]

        colonies.append((float(cx), float(cy), float(area)))

    return colonies


# =====================================================
# STEP 3 : ENTROPY HARVEST
# =====================================================
def harvest_entropy(binary, gray, colonies):

    parts = []

    parts.append(binary.tobytes())
    parts.append(gray.tobytes())

    for c in colonies[:100]:
        parts.append(struct.pack(">fff", c[0], c[1], c[2]))

    raw = b"".join(parts)

    if len(raw) == 0:
        raw = os.urandom(256)

    return raw


# =====================================================
# STEP 4 : HASH EXTRACTOR
# =====================================================
def hash_extract(raw):

    digest = hashlib.sha256(raw).digest()

    bits = np.unpackbits(np.frombuffer(digest, dtype=np.uint8))

    bit_string = ''.join(bits.astype(str))

    return bit_string, digest


# =====================================================
# STEP 5 : NIST TESTS
# =====================================================
def monobit(bits):

    arr = np.array(list(bits), dtype=np.uint8)

    n = len(arr)

    s = np.sum(np.where(arr == 1, 1, -1))

    sobs = abs(s) / np.sqrt(n)

    return float(math.erfc(sobs / np.sqrt(2)))


def runs(bits):

    arr = np.array(list(bits), dtype=np.uint8)

    n = len(arr)

    pi = arr.mean()

    if abs(pi - 0.5) >= 2 / np.sqrt(n):
        return 0.0

    runs_count = 1 + np.sum(arr[1:] != arr[:-1])

    num = abs(runs_count - 2 * n * pi * (1 - pi))

    den = 2 * np.sqrt(2 * n) * pi * (1 - pi)

    return float(math.erfc(num / den))


def block_frequency(bits, block=16):

    arr = np.array(list(bits), dtype=np.uint8)

    n = len(arr)

    N = n // block

    if N == 0:
        return 0.0

    arr = arr[:N * block].reshape(N, block)

    pi = arr.mean(axis=1)

    chi = 4 * block * np.sum((pi - 0.5) ** 2)

    return float(gammaincc(N / 2, chi / 2))


# =====================================================
# STEP 6 : KEY DERIVATION
# =====================================================
def derive_key(extracted):

    salt = hashlib.sha256(str(time.time()).encode()).digest()

    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"bacteria-key"
    )

    key = hkdf.derive(extracted)

    return key.hex()


# =====================================================
# ROUTE
# =====================================================
@app.route("/generate", methods=["POST"])
def generate():

    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]

        path = "temp_upload.png"

        file.save(path)

        gray, binary = preprocess(path)

        colonies = detect_colonies(binary)

        raw = harvest_entropy(binary, gray, colonies)

        bits, extracted = hash_extract(raw)

        key = derive_key(extracted)

        mono = monobit(bits)
        run = runs(bits)
        block = block_frequency(bits)

        tests = [
            {
                "name": "Monobit",
                "p": round(mono, 6),
                "pass": mono >= 0.01
            },
            {
                "name": "Runs",
                "p": round(run, 6),
                "pass": run >= 0.01
            },
            {
                "name": "Block Frequency",
                "p": round(block, 6),
                "pass": block >= 0.01
            }
        ]

        if mono >= 0.01 and run >= 0.01 and block >= 0.01:
            summary = "Excellent randomness profile. All tests passed."
        elif mono >= 0.01 and run >= 0.01:
            summary = "Good randomness profile with minor weakness."
        else:
            summary = "Weak randomness profile."

        # PRINT TO TERMINAL
        print("\n" + "=" * 60)
        print("IMAGE RECEIVED FROM FRONTEND")
        print("=" * 60)
        print("Colonies Detected :", len(colonies))
        print("Entropy Bytes     :", len(raw))
        print()
        print("Generated Key:")
        print(key)
        print()
        print("NIST TEST RESULTS")
        print("-" * 60)
        print("Monobit         :", round(mono, 6))
        print("Runs            :", round(run, 6))
        print("Block Frequency :", round(block, 6))
        print("-" * 60)
        print("Summary         :", summary)
        print("=" * 60)

        if os.path.exists(path):
            os.remove(path)

        return jsonify({
            "generatedKey": key,
            "tests": tests,
            "summary": summary
        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


# =====================================================
# RUN
# =====================================================
if __name__ == "__main__":
    app.run(port=8000, debug=True, use_reloader=False)