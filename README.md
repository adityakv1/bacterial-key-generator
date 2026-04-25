# 🛠️ Installation Steps

## 1️⃣ Clone Repository
```bash
git clone https://github.com/adityakv1/bacterial-key-generator.git
cd bacterial-key-generator
2️⃣ Frontend Setup
cd client
npm install
npm run dev

Frontend runs at:
http://localhost:5173

3️⃣ Backend Setup

Open a new terminal:

cd backend
npm install
npm run dev

Backend runs at:
http://localhost:5000

4️⃣ Python Setup

Open another terminal:

cd python

Create Conda Environment:

conda create -n bacteria_env python=3.10
conda activate bacteria_env

OR create venv:

python -m venv venv
venv\Scripts\activate
5️⃣ Install Python Dependencies

Create requirements.txt

flask
opencv-python
numpy
scipy
cryptography

Then run:

pip install -r requirements.txt
6️⃣ Run Python Service
python app.py

Python service runs at:
http://localhost:8000

7️⃣ Create Backend .env

Inside backend/.env

PORT=5000
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
▶️ Final Run (Use 3 Terminals)

Terminal 1:

cd client
npm run dev

Terminal 2:

cd backend
npm run dev

Terminal 3:

cd python
python app.py
