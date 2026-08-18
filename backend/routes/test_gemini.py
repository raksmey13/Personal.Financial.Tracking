import cat
from nis import cat

cat << 'EOF' > test_gemini.py
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ ERROR: GEMINI_API_KEY not found in .env file!")
    exit(1)

print("🔑 Found API Key. Connecting to Gemini...")

try:
    client = genai.Client(api_key=api_key)

    prompt = """
    Extract transaction details from this text: "Spent $4.50 on Coffee at Brown Coffee with ABA"
    Output JSON format: {"merchant": str, "amount": float, "currency": str}
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    print("\n✅ API KEY WORKS GREAT!")
    print("Gemini Parsed Response:")
    print(response.text)

except Exception as e:
    print(f"\n❌ Connection Failed: {e}")
EOF