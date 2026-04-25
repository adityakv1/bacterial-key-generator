# 🧬 Bacterial Key Generator

An AI-powered full-stack web application that generates cryptographic keys using bacterial colony images as a natural entropy source. The system combines image processing, entropy extraction, NIST randomness testing, secure key derivation, and LLM-based interpretation to evaluate the quality of generated keys.

---

# 📌 Table of Contents

1. Project Overview  
2. Problem Statement  
3. Objectives  
4. Key Features  
5. Tech Stack  
6. System Architecture  
7. Workflow  
8. Core Algorithms Used  
9. NIST Statistical Tests  
10. AI Interpretation Layer  
11. Project Structure  
12. Installation Guide  
13. API Routes  
14. Example Output  
15. Future Enhancements  
16. Author  

---

# 📖 Project Overview

Conventional cryptographic systems usually depend on pseudo-random number generators or hardware entropy modules for key generation. This project explores a bio-inspired alternative approach where bacterial colony growth patterns act as a natural source of randomness.

Every bacterial image contains unpredictable spatial patterns, texture noise, colony density variation, edge structures, and grayscale irregularities. These properties are harvested as entropy and transformed into secure keys.

The platform allows users to upload bacterial images through a web interface, generate secure keys, evaluate randomness using NIST tests, and receive AI-generated technical interpretations.

---

# ❗ Problem Statement

Modern random number generation systems can suffer from:

- Predictable pseudo-random seeds  
- Weak entropy sources  
- Hardware dependency  
- Lack of explainability  
- Limited natural randomness exploration  

This project addresses those issues by using biological image patterns as an alternative entropy source.

---

# 🎯 Objectives

- Generate secure keys from bacterial colony images  
- Apply computer vision for entropy harvesting  
- Perform NIST randomness validation  
- Use AI to interpret results intelligently  
- Store generated outputs for future reference  
- Build a full-stack deployable application  

---

# 🚀 Key Features

## 🔐 Secure Key Generation

- Uses bacterial image entropy
- SHA-256 based extraction
- HKDF for secure final key derivation
- Hexadecimal output format

## 🧫 Bacterial Image Upload

Users can upload:

- PNG
- JPG
- JPEG
- BMP

## 📊 Randomness Testing

Built-in NIST inspired tests:

- Monobit Frequency Test
- Runs Test
- Block Frequency Test

## 🤖 AI Interpretation

Uses Groq LLM to generate dynamic explanations of test results.

## 💾 Database Storage

Stores:

- Filename
- Generated key
- NIST test results
- AI summary
- Timestamp

## 🎨 Modern UI

Built with:

- React
- TypeScript
- Tailwind CSS
- shadcn/ui

---

# 🏗️ Tech Stack

## Frontend

- React.js
- TypeScript
- Vite
- Axios
- Tailwind CSS
- shadcn/ui

## Backend

- Node.js
- Express.js
- Multer
- Mongoose
- MongoDB

## Python Processing Engine

- Flask
- OpenCV
- NumPy
- SciPy
- Cryptography

## AI Layer

- Groq API
- Llama Models

---

# 🧠 System Architecture

```text
User Uploads Image
        ↓
React Frontend
        ↓
Node.js Express API
        ↓
Python Flask Engine
        ↓
Image Processing
        ↓
Entropy Extraction
        ↓
Key Generation
        ↓
NIST Testing
        ↓
Groq AI Interpretation
        ↓
MongoDB Storage
        ↓
Frontend Displays Results
