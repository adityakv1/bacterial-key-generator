from flask import Flask, request, jsonify
import os
import cv2
import numpy as np
import hashlib
import time
import struct
import math
import base64
import io

from scipy.special import gammaincc
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from skimage.feature import graycomatrix, graycoprops
from skimage.measure import label, regionprops

app = Flask(__name__)


# =====================================================
# COMMON PREPROCESS
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
# METHOD 1 FUNCTIONS
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

def hash_extract(raw):
    digest = hashlib.sha256(raw).digest()
    bits = np.unpackbits(np.frombuffer(digest, dtype=np.uint8))
    bit_string = ''.join(bits.astype(str))
    return bit_string, digest

# =====================================================
# NIST TESTS (Shared)
# =====================================================

def nist_monobit(bits):
    arr = np.array(list(bits), dtype=np.uint8)
    n = len(arr)
    s = np.sum(np.where(arr == 1, 1, -1))
    sobs = abs(s) / np.sqrt(n)
    return float(math.erfc(sobs / np.sqrt(2)))

def nist_block_frequency(bits, block=16):
    arr = np.array(list(bits), dtype=np.uint8)
    n = len(arr)
    N = n // block
    if N == 0: return 0.0
    arr = arr[:N * block].reshape(N, block)
    pi = arr.mean(axis=1)
    chi = 4 * block * np.sum((pi - 0.5) ** 2)
    return float(gammaincc(N / 2, chi / 2))

def nist_runs(bits):
    arr = np.array(list(bits), dtype=np.uint8)
    n = len(arr)
    pi = arr.mean()
    if abs(pi - 0.5) >= 2 / np.sqrt(n):
        return 0.0
    runs_count = 1 + np.sum(arr[1:] != arr[:-1])
    num = abs(runs_count - 2 * n * pi * (1 - pi))
    den = 2 * np.sqrt(2 * n) * pi * (1 - pi)
    return float(math.erfc(num / den))

def nist_longest_run(bits):
    # For n=256, use M=8, N=32
    M = 8
    N = 32
    arr = np.array(list(bits), dtype=np.uint8)
    blocks = arr[:N*M].reshape(N, M)
    
    counts = []
    for b in blocks:
        max_run = 0
        current_run = 0
        for bit in b:
            if bit == 1:
                current_run += 1
                max_run = max(max_run, current_run)
            else:
                current_run = 0
        counts.append(max_run)
    
    # Categories for M=8: <=1, 2, 3, >=4
    v = [0, 0, 0, 0]
    for c in counts:
        if c <= 1: v[0] += 1
        elif c == 2: v[1] += 1
        elif c == 3: v[2] += 1
        else: v[3] += 1
        
    pi = [0.2148, 0.3672, 0.2305, 0.1875]
    chi = sum(((v[i] - N * pi[i])**2) / (N * pi[i]) for i in range(4))
    return float(gammaincc(3/2, chi/2))

def nist_serial(bits, m=2):
    n = len(bits)
    # Add first m-1 bits to the end to make it circular
    extended_bits = bits + bits[:m-1]
    
    def psi_sq(m_val):
        if m_val == 0: return 0
        counts = {}
        for i in range(n):
            pattern = extended_bits[i:i+m_val]
            counts[pattern] = counts.get(pattern, 0) + 1
        
        sum_sq = sum(c**2 for c in counts.values())
        return (2**m_val / n) * sum_sq - n

    psim = psi_sq(m)
    psim1 = psi_sq(m-1)
    psim2 = psi_sq(m-2)
    
    del1 = psim - psim1
    del2 = psim - 2*psim1 + psim2
    
    p1 = float(gammaincc(2**(m-2), del1/2))
    p2 = float(gammaincc(2**(m-3), del2/2)) if m>2 else p1
    return (p1 + p2) / 2

def nist_approx_entropy(bits, m=2):
    n = len(bits)
    def phi(m_val):
        extended = bits + bits[:m_val-1]
        counts = {}
        for i in range(n):
            pattern = extended[i:i+m_val]
            counts[pattern] = counts.get(pattern, 0) + 1
        
        c_i = [c/n for c in counts.values()]
        return sum(c * math.log(c) for c in c_i if c > 0)

    ap_en = phi(m) - phi(m+1)
    chi = 2 * n * (math.log(2) - ap_en)
    return float(gammaincc(2**(m-1), chi/2))


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
# METHOD 2 FUNCTIONS
# =====================================================
FEATURE_BINS = {
    'Fractal Dimension': 8,
    'Lacunarity': 8,
    'GLCM Contrast': 8,
    'GLCM Correlation': 4,
    'Solidity': 4,
    'Eccentricity': 4,
    'Colony Count': 16,
    'Mean Colony Area': 8,
    'Intensity P25': 8,
    'Intensity P75': 8,
    'Coverage Ratio': 8,
}

FEATURE_RANGES = {
    'Fractal Dimension': (1.0, 2.0),
    'Lacunarity': (0.0, 1.0),
    'GLCM Contrast': (0.0, 50.0),
    'GLCM Correlation': (-1.0, 1.0),
    'Solidity': (0.0, 1.0),
    'Eccentricity': (0.0, 1.0),
    'Colony Count': (0, 500),
    'Mean Colony Area': (0, 10000),
    'Intensity P25': (0, 255),
    'Intensity P75': (0, 255),
    'Coverage Ratio': (0.0, 1.0),
}

def extract_features(gray, binary):
    props = [p for p in regionprops(label(binary)) if p.area>20]

    count = len(props)
    area = np.mean([p.area for p in props]) if props else 0
    solidity = np.mean([p.solidity for p in props]) if props else 0
    ecc = np.mean([p.eccentricity for p in props]) if props else 0

    glcm = graycomatrix((gray//8).astype(np.uint8), [1], [0], 32)
    contrast = graycoprops(glcm,'contrast')[0,0]
    corr = graycoprops(glcm,'correlation')[0,0]

    return {
        'Fractal Dimension': float(np.var(binary)),
        'Lacunarity': float(np.var(binary)),
        'GLCM Contrast': contrast,
        'GLCM Correlation': corr,
        'Solidity': solidity,
        'Eccentricity': ecc,
        'Colony Count': count,
        'Mean Colony Area': area,
        'Intensity P25': np.percentile(gray,25),
        'Intensity P75': np.percentile(gray,75),
        'Coverage Ratio': float((binary>0).sum()/binary.size)
    }

def quantize(features):
    bits=""
    parts={}
    for f,v in features.items():
        mn,mx = FEATURE_RANGES[f]
        bins = FEATURE_BINS[f]

        v=np.clip(v,mn,mx)
        idx=int((v-mn)/(mx-mn)*bins)
        idx=min(idx,bins-1)

        b=format(idx,f'0{int(np.log2(bins))}b')
        bits+=b
        parts[f]=(v,idx,b)

    return bits, parts

def sha256_key(bits):
    padded = bits.ljust((len(bits)+7)//8*8,'0')
    data = bytes(int(padded[i:i+8],2) for i in range(0,len(padded),8))
    h = hashlib.sha256(data).hexdigest()
    return h, bin(int(h,16))[2:].zfill(256)



def visualize_m2(gray, binary, feats, parts, bits, sha_bits):
    fig = plt.figure(figsize=(18,10))

    # images
    plt.subplot(2,3,1)
    plt.imshow(gray,cmap='gray')
    plt.title("Gray")

    plt.subplot(2,3,2)
    plt.imshow(binary,cmap='gray')
    plt.title("Binary")

    overlay = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    overlay[binary>0]=[0,255,0]

    plt.subplot(2,3,3)
    plt.imshow(overlay)
    plt.title("Overlay")

    # features
    plt.subplot(2,3,4)
    plt.barh(list(feats.keys()), list(feats.values()))
    plt.title("Features")

    # bit map
    plt.subplot(2,3,5)
    grid = np.array([int(b) for b in sha_bits]).reshape(16,16)
    plt.imshow(grid,cmap='RdYlGn')
    plt.title("SHA-256 bits")

    # stats
    plt.subplot(2,3,6)
    ones = sha_bits.count('1')
    plt.bar(["0","1"], [256-ones, ones])
    plt.title("Bit balance")

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return img_base64


# =====================================================
# ROUTE
# =====================================================
@app.route("/generate", methods=["POST"])
def generate():
    try:
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        file = request.files["image"]
        method = request.form.get("method", "1")
        
        path = "temp_upload.png"
        file.save(path)

        gray, binary = preprocess(path)

        if method == "1":
            colonies = detect_colonies(binary)
            raw = harvest_entropy(binary, gray, colonies)
            bits, extracted = hash_extract(raw)
            key_hex = derive_key(extracted)
            key_bit = bin(int(key_hex, 16))[2:].zfill(256)

            # NIST Tests for Method 1
            tests = [
                {"name": "Monobit", "p": round(nist_monobit(bits), 6)},
                {"name": "Block Frequency", "p": round(nist_block_frequency(bits), 6)},
                {"name": "Runs", "p": round(nist_runs(bits), 6)},
                {"name": "Longest Run", "p": round(nist_longest_run(bits), 6)},
                {"name": "Serial", "p": round(nist_serial(bits), 6)},
                {"name": "Approx Entropy", "p": round(nist_approx_entropy(bits), 6)}
            ]
            
            for t in tests: t["pass"] = t["p"] >= 0.01

            passed = sum(1 for t in tests if t["pass"])
            if passed == 6:
                summary = "Excellent randomness profile. All 6 NIST tests passed."
            elif passed >= 4:
                summary = "Good randomness profile. Most NIST tests passed."
            else:
                summary = "Weak randomness profile. Failed multiple NIST tests."
                
            visualization = None

        else: # Method 2
            feats = extract_features(gray, binary)
            bits, parts = quantize(feats)
            sha_hex, sha_bits = sha256_key(bits)
            key_hex = sha_hex
            key_bit = sha_bits
            
            # NIST Tests for Method 2
            tests = [
                {"name": "Monobit", "p": round(nist_monobit(sha_bits), 6)},
                {"name": "Block Frequency", "p": round(nist_block_frequency(sha_bits), 6)},
                {"name": "Runs", "p": round(nist_runs(sha_bits), 6)},
                {"name": "Longest Run", "p": round(nist_longest_run(sha_bits), 6)},
                {"name": "Serial", "p": round(nist_serial(sha_bits), 6)},
                {"name": "Approx Entropy", "p": round(nist_approx_entropy(sha_bits), 6)}
            ]
            
            for t in tests: t["pass"] = t["p"] >= 0.01

            passed = sum(1 for t in tests if t["pass"])
            if passed == 6:
                summary = "Method 2: Excellent. All 6 NIST tests passed."
            elif passed >= 4:
                summary = "Method 2: Good. Most NIST tests passed."
            else:
                summary = "Method 2: Weak randomness detected."
                
            visualization = None

        if os.path.exists(path):
            os.remove(path)

        response_data = {
            "bitKey": key_bit,
            "hexKey": key_hex,
            "tests": tests,
            "summary": summary
        }
        
        if visualization:
            response_data["visualization"] = visualization

        return jsonify(response_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================
# AES ENCRYPTION & DECRYPTION
# =====================================================

def visualize_aes(original_bytes, encrypted_bytes):
    orig = np.frombuffer(original_bytes, dtype=np.uint8)
    enc = np.frombuffer(encrypted_bytes, dtype=np.uint8)

    # To make a nice square-ish grid
    def get_grid(arr):
        size = int(np.ceil(np.sqrt(len(arr))))
        if size == 0: return np.zeros((1,1))
        padded = np.pad(arr, (0, size*size - len(arr)), mode='constant')
        return padded.reshape(size, size)

    orig_img = get_grid(orig)
    enc_img = get_grid(enc)

    fig = plt.figure(figsize=(10, 5))
    plt.subplot(1, 2, 1)
    plt.imshow(orig_img, cmap='plasma')
    plt.title("Original Data Structure")
    plt.axis('off')

    plt.subplot(1, 2, 2)
    plt.imshow(enc_img, cmap='plasma')
    plt.title("AES Encrypted (Noise)")
    plt.axis('off')

    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', transparent=True)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('utf-8')

@app.route("/encrypt", methods=["POST"])
def encrypt():
    try:
        key_hex = request.form.get("key")
        text = request.form.get("text", "")
        
        # Use first 32 bytes of hex key for AES-256
        key = bytes.fromhex(key_hex)[:32]
        iv = get_random_bytes(16)
        
        cipher = AES.new(key, AES.MODE_CBC, iv)
        data = text.encode('utf-8')
        encrypted = cipher.encrypt(pad(data, AES.block_size))
        
        # Combine IV + Ciphertext
        result_b64 = base64.b64encode(iv + encrypted).decode('utf-8')
        vis_b64 = visualize_aes(data, encrypted)
        
        return jsonify({
            "encrypted": result_b64,
            "visualization": vis_b64
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/decrypt", methods=["POST"])
def decrypt():
    try:
        key_hex = request.form.get("key")
        encrypted_b64 = request.form.get("encrypted")
        
        key = bytes.fromhex(key_hex)[:32]
        raw = base64.b64decode(encrypted_b64)
        
        iv = raw[:16]
        ct = raw[16:]
        
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(ct), AES.block_size)
        
        return jsonify({
            "decrypted": decrypted.decode('utf-8')
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=8000, debug=True, use_reloader=False)