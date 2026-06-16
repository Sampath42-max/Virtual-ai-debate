from flask import Flask, request, jsonify, send_file
from flask_pymongo import PyMongo
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from gtts import gTTS
import os
import random
import logging
import time
import socket
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from google.api_core.exceptions import ResourceExhausted, InvalidArgument
import hashlib
import re
from dotenv import load_dotenv
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from werkzeug.exceptions import HTTPException

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

application = Flask(__name__)
load_dotenv()


@application.errorhandler(Exception)
def handle_unexpected_error(error):
    if isinstance(error, HTTPException):
        return jsonify({"error": error.description}), error.code

    logger.exception("Unhandled application error")
    return jsonify({"error": "Internal server error"}), 500

# Enable CORS for local development, production, and Vercel preview deployments.
CORS(application, resources={
    r"/*": {
        "origins": [
            "http://localhost:8080",
            "http://localhost:5173",
            "https://virtual-ai-debate.vercel.app",
            r"https://.*\.vercel\.app",
        ]
    }
})



def normalize_mongo_uri(uri):
    """Fix an accidental double slash before the database name."""
    return uri.replace(".mongodb.net//", ".mongodb.net/", 1)


def with_mongo_timeouts(uri):
    if not uri:
        return uri

    parts = urlsplit(uri)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("serverSelectionTimeoutMS", "5000")
    query.setdefault("connectTimeoutMS", "5000")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


MONGO_URI = with_mongo_timeouts(normalize_mongo_uri(os.getenv("MONGO_URI", "")))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000").rstrip("/")
PORT = int(os.getenv("PORT", "5000"))

# MongoDB configuration
mongo = None
if MONGO_URI:
    application.config["MONGO_URI"] = MONGO_URI
    mongo = PyMongo(application)
else:
    logger.error("MONGO_URI not configured. Database endpoints will return errors until it is set.")

if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not configured. Debate response generation will be unavailable until it is set.")


# Verify MongoDB connection without preventing the web server from starting.
if mongo:
    try:
        mongo.db.command("ping")
        logger.info("Successfully connected to MongoDB")
    except Exception as e:
        logger.error(f"MongoDB ping failed during startup: {str(e)}")

# Create temporary directory for audio files
TEMP_AUDIO_DIR = os.path.join(os.getcwd(), "temp_audio")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

llm = None
if GEMINI_API_KEY:
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=GEMINI_API_KEY,
        max_retries=3,
        temperature=0.7,
        max_output_tokens=150
    )

prompt_template = PromptTemplate(
    input_variables=["topic", "stance", "user_message", "level"],
    template="""
You are an AI participating in a structured debate on the topic: '{topic}'.
Your position is: Oppose the user's stance ('{stance}').

The user said: "{user_message}"

Now respond directly to their argument with a well-reasoned counterpoint.

Use the debate level '{level}':
- Beginner: Use simple English. Reply with 1 short sentence using basic vocabulary.
- Intermediate: Use easy-to-understand English with 1-2 sentences.
- Advanced: Use clear English with 2 sentences and a focused counterpoint.
- Expert: Use sophisticated language, 2-3 sentences, include logical reasoning or real-world examples.

Always respond only in English. Your reply should directly challenge or build upon the user’s argument.
"""
)

# Create LangChain pipeline
chain = prompt_template | llm | StrOutputParser() if llm else None

# Audio cache to avoid regenerating identical responses
audio_cache = {}

# Password validation regex
password_regex = re.compile(r'^[a-zA-Z][a-zA-Z0-9!@#$%^&*]{7,}$')

# Allowed debate levels
ALLOWED_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}


def get_db():
    if not mongo:
        raise RuntimeError("MongoDB is not configured. Set MONGO_URI in the deployment environment.")
    return mongo.db

def sanitize_input(text):
    """Sanitize input by removing non-printable characters and excessive whitespace."""
    if not isinstance(text, str):
        logger.error(f"Invalid input type: {type(text)}")
        return ""
    text = re.sub(r'[^\x20-\x7E]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def get_gemini_response(user_message, topic, stance, level):
    logger.info(f"Generating Gemini response for topic: {topic}, stance: {stance}, level: {level}, message: {user_message}")
    user_message = sanitize_input(user_message)
    topic = sanitize_input(topic)
    stance = sanitize_input(stance)
    level = sanitize_input(level)
    
    if not user_message or not topic or not stance or not level:
        logger.error("Invalid input after sanitization")
        return "Sorry, the input is invalid. Please provide a valid argument, topic, stance, and level."
    
    if level not in ALLOWED_LEVELS:
        logger.error(f"Invalid debate level: {level}")
        return "Sorry, the selected debate level is invalid. Please choose Beginner, Intermediate, Advanced, or Expert."

    if not chain:
        logger.error("Gemini chain is unavailable because GEMINI_API_KEY is not configured")
        return "Sorry, the AI service is not configured yet. Please try again later."

    logger.debug(f"Sanitized inputs - message: {user_message}, topic: {topic}, stance: {stance}, level: {level}")
    logger.debug(f"Input character codes: {[ord(c) for c in user_message]}")
    start_time = time.time()
    try:
        response = chain.invoke({
            "topic": topic,
            "stance": stance,
            "user_message": user_message,
            "level": level
        })
        response = sanitize_input(response)
        logger.info(f"LangChain response received in {time.time() - start_time:.2f} seconds: {response}")
        if not response:
            logger.warning("Empty response from Gemini API")
            return "I understand your point, but let's consider another perspective."
        return response
    except ResourceExhausted as e:
        logger.error(f"Gemini API quota exceeded: {str(e)}")
        return "Sorry, we've reached our API quota. Please try again later or check your Gemini API plan at https://ai.google.dev/gemini-api/docs/rate-limits."
    except InvalidArgument as e:
        logger.error(f"Invalid argument in Gemini API call: {str(e)}")
        return "Sorry, the input was invalid. Please try a different argument."
    except Exception as e:
        logger.error(f"LangChain/Gemini API error: {str(e)}")
        return "I understand your point, but let's consider another perspective."

def delete_file_with_retry(filename, max_attempts=5, delay=2):
    for attempt in range(max_attempts):
        try:
            if os.path.exists(filename):
                os.remove(filename)
                logger.info(f"Deleted file: {filename}")
                return True
            return False
        except OSError as e:
            logger.error(f"Error deleting file {filename} (attempt {attempt + 1}): {str(e)}")
            if attempt < max_attempts - 1:
                time.sleep(delay)
    return False

def get_tts_audio(text):
    logger.info(f"Generating TTS audio for text: {text[:50]}...")
    start_time = time.time()
    text = sanitize_input(text)
    if not text:
        logger.error("Invalid text for TTS")
        return None
    cache_key = hashlib.md5(text.encode()).hexdigest()
    if cache_key in audio_cache:
        logger.info(f"Using cached audio for text: {text[:50]}...")
        return audio_cache[cache_key]

    audio_file = os.path.join(TEMP_AUDIO_DIR, f"ai_response_{random.randint(1000, 9999)}.mp3")
    try:
        tts_start = time.time()
        tts = gTTS(text=text[:100], lang='en')
        tts.save(audio_file)
        if not os.path.exists(audio_file):
            logger.error(f"Audio file not created: {audio_file}")
            return None
        logger.info(f"Audio file generated in {time.time() - tts_start:.2f} seconds: {audio_file}, size: {os.path.getsize(audio_file)} bytes")
        audio_cache[cache_key] = audio_file
        return audio_file
    except Exception as e:
        logger.error(f"gTTS error: {str(e)}")
        delete_file_with_retry(audio_file)
        return None

def parse_request_json():
    try:
        data = request.get_json(force=True)
        logger.info(f"Parsed JSON: {data}")
        return data, None
    except Exception as e:
        logger.error(f"Failed to parse JSON: {str(e)}")
        return None, (jsonify({"error": f"Invalid JSON format: {str(e)}"}), 400)


@application.route('/api/signup', methods=['POST'])
@application.route('/signup', methods=['POST'])
def signup():
    logger.info("Signup endpoint called")
    data, error_response = parse_request_json()
    if error_response:
        return error_response

    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirm_password')

    if not all([name, email, password, confirm_password]):
        return jsonify({"error": "All fields are required"}), 400
    if password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400
    if not password_regex.match(password):
        return jsonify({
            "error": "Password must be 8+ characters, start with a letter, and include alphabets, numbers, and symbols"
        }), 400

    try:
        db = get_db()
        if db.users.find_one({"email": email}):
            return jsonify({"error": "Email already registered"}), 400

        hashed_password = generate_password_hash(password)
        db.users.insert_one({
            "name": name,
            "email": email,
            "password": hashed_password,
            "debates_attended": 0,
            "profile_picture": ""
        })
        return jsonify({
            "message": "User registered successfully",
            "user": {
                "name": name,
                "email": email,
                "debates_attended": 0,
                "profile_picture": ""
            }
        }), 201
    except Exception as e:
        logger.error(f"Signup failed: {str(e)}")
        return jsonify({"error": "Failed to register user"}), 500

@application.route('/api/login', methods=['POST'])
@application.route('/login', methods=['POST'])
def login():
    logger.info("Login endpoint called")
    data, error_response = parse_request_json()
    if error_response:
        return error_response

    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = get_db().users.find_one({"email": email})
        if user and check_password_hash(user['password'], password):
            return jsonify({
                "message": "Login successful",
                "user": {
                    "name": user['name'],
                    "email": user['email'],
                    "debates_attended": user.get('debates_attended', 0),
                    "profile_picture": user.get('profile_picture', '')
                }
            }), 200
        return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        return jsonify({"error": "Failed to login"}), 500

@application.route('/api/profile', methods=['POST'])
@application.route('/profile', methods=['POST'])
def profile():
    logger.info("Profile endpoint called")
    data, error_response = parse_request_json()
    if error_response:
        return error_response

    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400

    try:
        user = get_db().users.find_one({"email": email})
        if user:
            return jsonify({
                "user": {
                    "name": user['name'],
                    "email": user['email'],
                    "debates_attended": user.get('debates_attended', 0),
                    "profile_picture": user.get('profile_picture', '')
                }
            }), 200
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        logger.error(f"Profile fetch failed: {str(e)}")
        return jsonify({"error": "Failed to fetch profile"}), 500

@application.route('/api/debate/response', methods=['POST'])
def get_debate_response():
    logger.info("Debate response endpoint called")
    data, error_response = parse_request_json()
    if error_response:
        return error_response

    user_message = data.get('message')
    topic = data.get('topic')
    stance = data.get('stance')
    level = data.get('level')

    if not all([user_message, topic, stance, level]):
        return jsonify({"error": "Message, topic, stance, and level are required"}), 400

    ai_response = get_gemini_response(user_message, topic, stance, level)
    audio_file = get_tts_audio(ai_response)
    if not audio_file:
        return jsonify({"error": "Failed to generate audio file"}), 500

    return jsonify({
        "message": ai_response,
        "audio_url": f"{BACKEND_URL}/api/debate/audio/{os.path.basename(audio_file)}"
    }), 200


@application.route('/api/debate/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    logger.info(f"Serving audio file: {filename}")
    audio_path = os.path.join(TEMP_AUDIO_DIR, filename)
    try:
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            return jsonify({"error": "Audio file not found"}), 404
        response = send_file(audio_path, mimetype="audio/mpeg")
        if audio_path not in audio_cache.values():
            delete_file_with_retry(audio_path)
        return response
    except Exception as e:
        logger.error(f"Error serving audio file {audio_path}: {str(e)}")
        return jsonify({"error": "Failed to serve audio file"}), 500

@application.route('/api/debate/complete', methods=['POST'])
def complete_debate():
    logger.info("Debate complete endpoint called")
    data, error_response = parse_request_json()
    if error_response:
        return error_response

    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400

    try:
        db = get_db()
        user = db.users.find_one({"email": email})
        if user:
            db.users.update_one(
                {"email": email},
                {"$inc": {"debates_attended": 1}}
            )
            return jsonify({"message": "Debate count updated"}), 200
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        logger.error(f"Debate count update failed: {str(e)}")
        return jsonify({"error": "Failed to update debate count"}), 500

@application.route('/')
def index():
    logger.info("Root endpoint called")
    return jsonify({"message": "Welcome to DebateAI API"}), 200


@application.route('/health')
def health():
    return jsonify({
        "status": "ok",
        "mongo_configured": bool(MONGO_URI),
        "gemini_configured": bool(GEMINI_API_KEY),
    }), 200

if __name__ == '__main__':
    logger.info("Starting Flask server for local development")
    application.run(debug=True, host='0.0.0.0', port=PORT)
