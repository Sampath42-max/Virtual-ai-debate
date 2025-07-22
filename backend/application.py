from flask import Flask, request, jsonify, send_file
from flask_pymongo import PyMongo
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from gtts import gTTS
import os
import random
import logging
import time
import hashlib
import re
import atexit
import shutil
from datetime import datetime
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from google.api_core.exceptions import ResourceExhausted, InvalidArgument
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
application = Flask(__name__)

# Security and rate limiting
limiter = Limiter(
    app=application,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

CORS(application, resources={r"/api/*": {
    "origins": [
        "http://virtual-si-debate-frontend.s3-website.ap-south-1.amazonaws.com"
    ],
    "supports_credentials": True,
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

application.config["MONGO_URI"] = os.getenv("MONGO_URI")
if not application.config["MONGO_URI"]:
    raise EnvironmentError("MONGO_URI not set in environment.")

mongo = PyMongo(application, retryWrites=True, connectTimeoutMS=30000)

try:
    mongo.db.users.create_index("email", unique=True)
    mongo.db.users.create_index("debates_attended")
    logger.info("Database indexes created")
except Exception as e:
    logger.error(f"Index creation failed: {e}")

TEMP_AUDIO_DIR = os.path.join(os.getcwd(), "temp_audio")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY not set in environment.")

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
- Beginner: Simple English.
- Intermediate: 1–2 sentences.
- Advanced: 2 sentences with a counterpoint.
- Expert: 2–3 logical sentences or real-world examples.

Only reply in English.
"""
)

chain = prompt_template | llm | StrOutputParser()

audio_cache = {}
password_regex = re.compile(r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$')
ALLOWED_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}
MAX_AUDIO_FILES = 100
AUDIO_FILE_TTL = 3600

def sanitize_input(text):
    if not isinstance(text, str):
        return ""
    text = re.sub(r'[^\x20-\x7E]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:500]

def validate_email(email):
    return re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email)

def cleanup_audio_files():
    try:
        now = time.time()
        files = os.listdir(TEMP_AUDIO_DIR)
        if len(files) > MAX_AUDIO_FILES:
            for f in files:
                file_path = os.path.join(TEMP_AUDIO_DIR, f)
                if os.path.isfile(file_path) and now - os.path.getmtime(file_path) > AUDIO_FILE_TTL:
                    os.remove(file_path)
                    logger.info(f"Removed old audio file: {f}")
    except Exception as e:
        logger.error(f"Audio cleanup error: {e}")

def get_tts_audio(text):
    text = sanitize_input(text)
    if not text:
        return None
    cache_key = hashlib.md5(text.encode()).hexdigest()
    if cache_key in audio_cache:
        return audio_cache[cache_key]
    cleanup_audio_files()
    try:
        audio_file = os.path.join(TEMP_AUDIO_DIR, f"ai_response_{int(time.time())}.mp3")
        tts = gTTS(text=text, lang='en')
        tts.save(audio_file)
        audio_cache[cache_key] = audio_file
        return audio_file
    except Exception as e:
        logger.error(f"gTTS failed: {e}")
        return None

def get_gemini_response(user_message, topic, stance, level):
    try:
        user_message = sanitize_input(user_message)
        topic = sanitize_input(topic)
        stance = sanitize_input(stance)
        level = sanitize_input(level)
        if not all([user_message, topic, stance]) or level not in ALLOWED_LEVELS:
            return "Invalid input or level."
        response = chain.invoke({
            "topic": topic,
            "stance": stance,
            "user_message": user_message,
            "level": level
        })
        return sanitize_input(response)
    except ResourceExhausted:
        logger.warning("Gemini API quota exceeded")
        return "Our debate service is currently at capacity. Please try again later."
    except InvalidArgument as e:
        logger.error(f"Invalid Gemini argument: {e}")
        return "There was an issue processing your debate input."
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return "Our debate AI is currently unavailable. Please try again later."

def standard_response(success, message, data=None, error=None, status_code=200):
    response = {
        "success": success,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data if data else {},
        "error": error if error else None
    }
    return jsonify(response), status_code

def require_json(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            return standard_response(False, "Content-Type must be application/json", None, "Invalid content type", 400)
        return f(*args, **kwargs)
    return decorated_function

@application.route('/')
def index():
    return standard_response(True, "Welcome to DebateAI API")

@application.route('/health')
def health_check():
    try:
        mongo.db.command('ping')
        return standard_response(True, "Service is healthy", {
            "database": "connected",
            "status": "operational"
        })
    except Exception as e:
        return standard_response(False, "Service is unhealthy", None, str(e), 500)

@application.route('/api/signup', methods=['POST', 'OPTIONS'])
@require_json
@limiter.limit("5 per minute")
def signup():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json()
        name = sanitize_input(data.get('name'))
        email = sanitize_input(data.get('email'))
        password = data.get('password')
        confirm_password = data.get('confirm_password')

        if not all([name, email, password, confirm_password]):
            return standard_response(False, "All fields are required", None, "Missing fields", 400)
        if not validate_email(email):
            return standard_response(False, "Invalid email format", None, "Invalid email", 400)
        if password != confirm_password:
            return standard_response(False, "Passwords do not match", None, "Password mismatch", 400)
        if not password_regex.match(password):
            return standard_response(False, "Password must be at least 8 characters with one letter, one number and one special character", None, "Weak password", 400)
        if mongo.db.users.find_one({"email": email}):
            return standard_response(False, "Email already exists", None, "Duplicate email", 400)

        hashed = generate_password_hash(password)
        mongo.db.users.insert_one({
            "name": name,
            "email": email,
            "password": hashed,
            "debates_attended": 0,
            "profile_picture": "",
            "created_at": datetime.utcnow(),
            "last_login": None
        })

        return standard_response(True, "Registration successful", {
            "user": {
                "name": name,
                "email": email
            }
        }, None, 201)
    except Exception as e:
        logger.error(f"Signup error: {e}")
        return standard_response(False, "Registration failed", None, str(e), 500)

@application.route('/api/login', methods=['POST', 'OPTIONS'])
@require_json
@limiter.limit("5 per minute")
def login():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email'))
        password = data.get('password')

        if not all([email, password]):
            return standard_response(False, "Email and password required", None, "Missing credentials", 400)

        user = mongo.db.users.find_one({"email": email})
        if not user or not check_password_hash(user['password'], password):
            return standard_response(False, "Invalid credentials", None, "Authentication failed", 401)

        mongo.db.users.update_one({"email": email}, {"$set": {"last_login": datetime.utcnow()}})

        return standard_response(True, "Login successful", {
            "user": {
                "name": user['name'],
                "email": user['email'],
                "debates_attended": user.get('debates_attended', 0),
                "profile_picture": user.get('profile_picture', '')
            }
        })
    except Exception as e:
        logger.error(f"Login error: {e}")
        return standard_response(False, "Login failed", None, str(e), 500)

@application.route('/api/profile', methods=['POST', 'OPTIONS'])
@require_json
def profile():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email'))
        if not email:
            return standard_response(False, "Email is required", None, "Missing email", 400)
        user = mongo.db.users.find_one({"email": email})
        if not user:
            return standard_response(False, "User not found", None, "User not found", 404)
        return standard_response(True, "Profile retrieved", {
            "user": {
                "name": user['name'],
                "email": user['email'],
                "debates_attended": user.get('debates_attended', 0),
                "profile_picture": user.get('profile_picture', ''),
                "created_at": user.get('created_at', '').isoformat() if user.get('created_at') else None,
                "last_login": user.get('last_login', '').isoformat() if user.get('last_login') else None
            }
        })
    except Exception as e:
        logger.error(f"Profile error: {e}")
        return standard_response(False, "Profile retrieval failed", None, str(e), 500)

@application.route('/api/debate/response', methods=['POST', 'OPTIONS'])
@require_json
def get_debate_response():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json()
        user_message = data.get('message')
        topic = data.get('topic')
        stance = data.get('stance')
        level = data.get('level', 'Intermediate')
        if not all([user_message, topic, stance]):
            return standard_response(False, "Missing required fields", None, "Incomplete request", 400)
        ai_response = get_gemini_response(user_message, topic, stance, level)
        audio_file = get_tts_audio(ai_response)
        if not audio_file:
            return standard_response(True, "AI response generated (no audio)", {"message": ai_response})
        return standard_response(True, "AI response generated", {
            "message": ai_response,
            "audio_url": f"{request.host_url}api/debate/audio/{os.path.basename(audio_file)}"
        })
    except Exception as e:
        logger.error(f"Debate response error: {e}")
        return standard_response(False, "Failed to generate debate response", None, str(e), 500)

@application.route('/api/debate/audio/<filename>', methods=['GET', 'OPTIONS'])
def serve_audio(filename):
    if request.method == 'OPTIONS':
        return '', 200
    try:
        if not re.match(r'^ai_response_\d+\.mp3$', filename):
            return standard_response(False, "Invalid filename", None, "Invalid request", 400)
        path = os.path.join(TEMP_AUDIO_DIR, filename)
        if not os.path.exists(path):
            return standard_response(False, "Audio not found", None, "Resource not found", 404)
        return send_file(path, mimetype="audio/mpeg")
    except Exception as e:
        logger.error(f"Audio serve error: {e}")
        return standard_response(False, "Failed to serve audio", None, str(e), 500)

@application.route('/api/debate/complete', methods=['POST', 'OPTIONS'])
@require_json
def complete_debate():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email'))
        if not email:
            return standard_response(False, "Email is required", None, "Missing email", 400)
        result = mongo.db.users.update_one({"email": email}, {"$inc": {"debates_attended": 1}})
        if result.modified_count == 0:
            return standard_response(False, "User not found", None, "Update failed", 404)
        return standard_response(True, "Debate count updated")
    except Exception as e:
        logger.error(f"Debate completion error: {e}")
        return standard_response(False, "Failed to update debate count", None, str(e), 500)

atexit.register(cleanup_audio_files)

if __name__ == '__main__':
    application.run(host='0.0.0.0', port=5000)
