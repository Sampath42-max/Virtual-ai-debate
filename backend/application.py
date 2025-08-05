from flask import Flask, request, jsonify, send_file
from flask_pymongo import PyMongo
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
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
from pymongo.errors import ConnectionFailure
import glob
import stat

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

application = Flask(__name__)

# Enable CORS for all required endpoints
CORS(application, resources={
    r"/*": {"origins": ["http://localhost:8080", "https://virtual-ai-debate.vercel.app"]}
})

# Load environment variables
MONGO_URI = os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
PORT = int(os.getenv("PORT", 5000))

# Validate environment variables
if not MONGO_URI:
    logger.critical("MONGO_URI not configured.")
    raise EnvironmentError("Missing MONGO_URI configuration.")
if not GEMINI_API_KEY:
    logger.critical("GEMINI_API_KEY not configured.")
    raise EnvironmentError("Missing GEMINI_API_KEY configuration.")

# MongoDB configuration
application.config["MONGO_URI"] = MONGO_URI
mongo = PyMongo(application)

# Verify MongoDB connection with retry
max_retries = 3
for attempt in range(max_retries):
    try:
        mongo.db.command("ping")
        logger.info("Successfully connected to MongoDB")
        break
    except ConnectionFailure as e:
        logger.error(f"Attempt {attempt + 1} failed to connect to MongoDB: {str(e)}")
        if attempt < max_retries - 1:
            time.sleep(2)
        else:
            logger.critical("MongoDB connection failed after retries.")
            raise Exception("MongoDB connection failed. Please check the URI and network settings.")

# Create temporary directory for audio files
TEMP_AUDIO_DIR = os.path.join(os.getcwd(), "temp_audio")
def ensure_directory_writable(directory):
    os.makedirs(directory, exist_ok=True)
    os.chmod(directory, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)  # Full permissions
    logger.info(f"Ensured directory is writable: {directory}")
ensure_directory_writable(TEMP_AUDIO_DIR)

# Rate limiter setup
limiter = Limiter(
    get_remote_address,
    app=application,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

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
chain = prompt_template | llm | StrOutputParser()

# Audio cache to avoid regenerating identical responses
audio_cache = {}

# Password validation regex
password_regex = re.compile(r'^[a-zA-Z][a-zA-Z0-9!@#$%^&*]{7,}$')

# Allowed debate levels
ALLOWED_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}

def sanitize_input(text):
    """Sanitize input by removing non-printable characters and excessive whitespace."""
    if not isinstance(text, str):
        logger.error(f"Invalid input type: {type(text)}")
        return ""
    text = re.sub(r'[^\x20-\x7E]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def cleanup_old_audio_files(max_age_seconds=3600):
    """Clean up audio files older than max_age_seconds."""
    now = time.time()
    for file in glob.glob(os.path.join(TEMP_AUDIO_DIR, "*.mp3")):
        if os.path.getmtime(file) < now - max_age_seconds:
            delete_file_with_retry(file)
            logger.info(f"Cleaned up old audio file: {file}")

def get_gemini_response(user_message, topic, stance, level):
    logger.info(f"Generating Gemini response for topic: {topic}, stance: {stance}, level: {level}, message: {user_message}")
    user_message = sanitize_input(user_message)
    topic = sanitize_input(topic)
    stance = sanitize_input(stance)
    level = sanitize_input(level)
    
    if not user_message or not topic or not stance or not level:
        logger.error("Invalid input after sanitization")
        return jsonify({"error": "Invalid input provided."}), 400
    
    if level not in ALLOWED_LEVELS:
        logger.error(f"Invalid debate level: {level}")
        return jsonify({"error": "Invalid debate level. Choose Beginner, Intermediate, Advanced, or Expert."}), 400

    logger.debug(f"Sanitized inputs - message: {user_message}, topic: {topic}, stance: {stance}, level: {level}")
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
        return jsonify({
            "error": "API quota exceeded. Please try again later or check your Gemini API plan.",
            "details": str(e)
        }), 429
    except InvalidArgument as e:
        logger.error(f"Invalid argument in Gemini API call: {str(e)}")
        return jsonify({"error": "Invalid input for Gemini API."}), 400
    except Exception as e:
        logger.error(f"LangChain/Gemini API error: {str(e)}")
        return jsonify({"error": "Failed to generate response."}), 500

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
        cleanup_old_audio_files()  # Clean up old files
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
        return None, jsonify({"error": f"Invalid JSON format: {str(e)}"}), 400

@application.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {str(e)}", exc_info=True)
    return jsonify({"error": "An unexpected error occurred. Please try again later."}), 500

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
        if mongo.db.users.find_one({"email": email}):
            return jsonify({"error": "Email already registered"}), 400

        hashed_password = generate_password_hash(password)
        mongo.db.users.insert_one({
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
        user = mongo.db.users.find_one({"email": email})
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
        user = mongo.db.users.find_one({"email": email})
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
@limiter.limit("10 per minute")  # Rate limit to 10 requests per minute
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
    if isinstance(ai_response, tuple):  # Error response from get_gemini_response
        return ai_response

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
        user = mongo.db.users.find_one({"email": email})
        if user:
            mongo.db.users.update_one(
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

if __name__ == '__main__':
    logger.info("Starting Flask server for local development")
    application.run(debug=True, host='0.0.0.0', port=PORT)
