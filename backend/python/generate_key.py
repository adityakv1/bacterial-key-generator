import cv2
import numpy as np
import hashlib
import hmac
import time
import struct
import math
import os

from scipy.special import gammaincc
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from tkinter import Tk
from tkinter.filedialog import askopenfilename


# =====================================================
# FILE PICKER
# =====================================================
Tk().withdraw()

image_path = askopenfilename(
    title="Select Bacterial Image",
    filetypes=[
        ("Image Files", "*.png *.jpg *.jpeg *.bmp")
    ]
)

if not image_path:
    print("No image selected")
    exit()


# =====================================================
# STEP 1 : PREPROCESS
# =====================================================
def preprocess(image_path):

    img = cv2.imread(image_path)

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

    return img, gray, binary


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
# STEP 3 : HARVEST ENTROPY
# =====================================================
def harvest_entropy(binary, gray, colonies):

    parts = []

    parts.append(binary.tobytes())
    parts.append(gray.tobytes())

    for c in colonies[:100]:
        parts.append(struct.pack(">fff", c[0], c[1], c[2]))

    raw_bytes = b"".join(parts)

    if len(raw_bytes) == 0:
        raw_bytes = os.urandom(256)

    return raw_bytes


# =====================================================
# STEP 4 : HASH EXTRACTOR
# =====================================================
def hash_extract(raw_bytes, target_bits=8192):

    extracted = bytearray()

    counter = 0

    while len(extracted) * 8 < target_bits:

        key = struct.pack(">Q", counter)

        digest = hmac.new(
            key,
            raw_bytes,
            hashlib.sha256
        ).digest()

        extracted += digest
        counter += 1

    total_bytes = (target_bits + 7) // 8

    extracted = extracted[:total_bytes]

    bits = np.unpackbits(
        np.frombuffer(extracted, dtype=np.uint8)
    )

    bit_string = ''.join(bits.astype(str))[:target_bits]

    return bit_string, bytes(extracted)


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


def block_frequency(bits, block=128):

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
# STEP 6 : DERIVE KEY
# =====================================================
def derive_key(extracted):

    salt = hashlib.sha256(
        str(time.time()).encode()
    ).digest()

    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"bacteria-key"
    )

    key = hkdf.derive(extracted)

    return key.hex()


# =====================================================
# MAIN
# =====================================================
if __name__ == "__main__":

    print("=" * 60)
    print("BACTERIAL IMAGE KEY GENERATOR")
    print("=" * 60)

    img, gray, binary = preprocess(image_path)

    colonies = detect_colonies(binary)

    raw_bytes = harvest_entropy(binary, gray, colonies)

    bits, extracted = hash_extract(raw_bytes)

    mono = monobit(bits)
    run = runs(bits)
    block = block_frequency(bits)

    key = derive_key(extracted)

    print("Image Selected   :", image_path)
    print("Colonies Detected:", len(colonies))
    print("Entropy Bytes    :", len(raw_bytes))
    print()

    print("Generated Key:")
    print(key)
    print()

    print("NIST TEST RESULTS")
    print("-" * 60)
    print(f"Monobit         : {mono:.6f}")
    print(f"Runs            : {run:.6f}")
    print(f"Block Frequency : {block:.6f}")
    print("-" * 60)

    if mono >= 0.01 and run >= 0.01 and block >= 0.01:
        print("Overall Result  : PASS")
    else:
        print("Overall Result  : WEAK")

    print("=" * 60)