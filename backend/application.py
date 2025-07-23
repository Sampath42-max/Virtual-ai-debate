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
from datetime import datetime, timedelta
from functools import wraps
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from google.api_core.exceptions import ResourceExhausted, InvalidArgument
import jwt
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
CORS(application, resources={r"/*": {
    "origins": ["https://virtual-ai-debate.vercel.app"],
    "supports_credentials": True,
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# Database Configuration
application.config["MONGO_URI"] = os.getenv("MONGO_URI")
if not application.config["MONGO_URI"]:
    logger.error("MONGO_URI not set in environment. Check .env file or Render environment variables.")
    raise EnvironmentError("MONGO_URI not set in environment.")

mongo = PyMongo(application, retryWrites=True, connectTimeoutMS=30000)

# Create indexes
try:
    mongo.db.users.create_index("email", unique=True)
    mongo.db.users.create_index("debates_attended")
    logger.info("Database indexes created")
except Exception as e:
    logger.error(f"Index creation failed: {e}")

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    logger.error("JWT_SECRET_KEY not set in environment. Check .env file or Render environment variables.")
    raise EnvironmentError("JWT_SECRET_KEY not set in environment.")

# Audio Configuration
TEMP_AUDIO_DIR = os.path.join(os.getcwd(), "temp_audio")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)

# Gemini AI Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not set in environment. Check .env file or Render environment variables.")
    raise EnvironmentError("GEMINI_API_KEY not set in environment.")

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=GEMINI_API_KEY,
    max_retries=3,
    temperature=0.7,
    max_output_tokens=150
)

# Prompt Template
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

# Constants
audio_cache = {}
password_regex = re.compile(r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$')
ALLOWED_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}
MAX_AUDIO_FILES = 100
AUDIO_FILE_TTL = 3600  # 1 hour in seconds

# Helper Functions
def sanitize_input(text):
    """Sanitize user input to prevent injection attacks"""
    if not isinstance(text, str):
        return ""
    text = re.sub(r'[^\x20-\x7E]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:500]

def validate_email(email):
    """Basic email validation"""
    return re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email)

def cleanup_audio_files():
    """Clean up old audio files"""
    try:
        now = time.time()
        files = os.listdir(TEMP_AUDIO_DIR)
        
        if len(files) > MAX_AUDIO_FILES:
            for f in files:
                file_path = os.path.join(TEMP_AUDIO_DIR, f)
                if os.path.isfile(file_path):
                    if now - os.path.getmtime(file_path) > AUDIO_FILE_TTL:
                        os.remove(file_path)
                        logger.info(f"Removed old audio file: {f}")
    except Exception as e:
        logger.error(f"Audio cleanup error: {e}")

def get_tts_audio(text):
    """Generate and cache TTS audio"""
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
    """Get response from Gemini AI with enhanced error handling"""
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
    """Standardized API response format"""
    response = {
        "success": success,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data if data else {},
        "error": error if error else None
    }
    return jsonify(response), status_code

def require_json(f):
    """Decorator to require JSON content type"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            return standard_response(False, "Content-Type must be application/json", None, "Invalid content type", 400)
        return f(*args, **kwargs)
    return decorated_function

# Routes
@application.route('/')
def index():
    return standard_response(True, "Welcome to DebateAI API")

@application.route('/health')
def health_check():
    """Health check endpoint for monitoring"""
    try:
        mongo.db.command('ping')
        return standard_response(True, "Service is healthy", {
            "database": "connected",
            "status": "operational"
        })
    except Exception as e:
        return standard_response(False, "Service is unhealthy", None, str(e), 500)

@application.route('/api/signup', methods=['POST'])
@require_json
@limiter.limit("5 per minute")
def signup():
    """User registration endpoint"""
    try:
        data = request.get_json()
        name = sanitize_input(data.get('name'))
        email = sanitize_input(data.get('email'))
        password = data.get('password')
        confirm_password = data.get('confirm_password')

        # Validation
        if not all([name, email, password, confirm_password]):
            return standard_response(False, "All fields are required", None, "Missing fields", 400)
        
        if not validate_email(email):
            return standard_response(False, "Invalid email format", None, "Invalid email", 400)
        
        if password != confirm_password:
            return standard_response(False, "Passwords do not match", None, "Password mismatch", 400)
        
        if not password_regex.match(password):
            return standard_response(False, "Password must be at least 8 characters with one letter, one number and one special character", 
                                  None, "Weak password", 400)

        # Check existing user
        if mongo.db.users.find_one({"email": email}):
            return standard_response(False, "Email already exists", None, "Duplicate email", 400)

        # Create user
        hashed = generate_password_hash(password)
        user_data = {
            "name": name,
            "email": email,
            "password": hashed,
            "debates_attended": 0,
            "profile_picture": "",
            "created_at": datetime.utcnow(),
            "last_login": None
        }
        mongo.db.users.insert_one(user_data)

        # Generate JWT token
        token = jwt.encode(
            {
                "email": email,
                "exp": datetime.utcnow() + timedelta(hours=24)
            },
            JWT_SECRET_KEY,
            algorithm="HS256"
        )

        return standard_response(True, "Registration successful", {
            "user": {
                "name": name,
                "email": email
            },
            "token": token
        }, None, 201)

    except Exception as e:
        logger.error(f"Signup error: {e}")
        return standard_response(False, "Registration failed", None, str(e), 500)

@application.route('/api/login', methods=['POST'])
@require_json
@limiter.limit("5 per minute")
def login():
    """User authentication endpoint"""
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email'))
        password = data.get('password')

        if not all([email, password]):
            return standard_response(False, "Email and password required", None, "Missing credentials", 400)

        user = mongo.db.users.find_one({"email": email})
        if not user or not check_password_hash(user['password'], password):
            return standard_response(False, "Invalid credentials", None, "Authentication failed", 401)

        # Generate JWT token
        token = jwt.encode(
            {
                "email": email,
                "exp": datetime.utcnow() + timedelta(hours=24)
            },
            JWT_SECRET_KEY,
            algorithm="HS256"
        )

        # Update last login
        mongo.db.users.update_one(
            {"email": email},
            {"$set": {"last_login": datetime.utcnow()}}
        )

        return standard_response(True, "Login successful", {
            "user": {
                "name": user['name'],
                "email": user['email'],
                "debates_attended": user.get('debates_attended', 0),
                "profile_picture": user.get('profile_picture', '')
            },
            "token": token
        })

    except Exception as e:
        logger.error(f"Login error: {e}")
        return standard_response(False, "Login failed", None, str(e), 500)

@application.route('/api/profile', methods=['POST'])
@require_json
def profile():
    """User profile endpoint"""
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

@application.route('/api/debate/response', methods=['POST'])
@require_json
def get_debate_response():
    """Debate AI response endpoint"""
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
            return standard_response(True, "AI response generated (no audio)", {
            "message": ai_response
        })

        return standard_response(True, "AI response generated", {
            "message": ai_response,
            "audio_url": f"{request.host_url}api/debate/audio/{os.path.basename(audio_file)}"
        })

    except Exception as e:
        logger.error(f"Debate response error: {e}")
        return standard_response(False, "Failed to generate debate response", None, str(e), 500)

@application.route('/api/debate/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    """Audio file serving endpoint"""
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

@application.route('/api/debate/complete', methods=['POST'])
@require_json
def complete_debate():
    """Debate completion endpoint"""
    try:
        data = request.get_json()
        email = sanitize_input(data.get('email'))

        if not email:
            return standard_response(False, "Email is required", None, "Missing email", 400)

        result = mongo.db.users.update_one(
            {"email": email},
            {"$inc": {"debates_attended": 1}}
        )

        if result.modified_count == 0:
            return standard_response(False, "User not found", None, "Update failed", 404)

        return standard_response(True, "Debate count updated")

    except Exception as e:
        logger.error(f"Debate completion error: {e}")
        return standard_response(False, "Failed to update debate count", None, str(e), 500)

# Cleanup on exit
atexit.register(cleanup_audio_files)

if __name__ == '__main__':
    application.run(host='0.0.0.0', port=5000)
