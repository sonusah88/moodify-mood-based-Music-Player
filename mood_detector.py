import base64
from io import BytesIO
from PIL import Image
import numpy as np
from fer import FER

# Initialize FER detector
detector = FER()

def detect_mood_from_base64(img_data):
    """Detect mood from base64 image data."""
    if not img_data or not img_data.startswith('data:image'):
        raise ValueError("Invalid image data")

    # Decode base64 image
    header, encoded = img_data.split(",", 1)
    img_bytes = base64.b64decode(encoded)
    img = Image.open(BytesIO(img_bytes)).convert('RGB')
    frame = np.array(img)

    # Detect emotions
    results = detector.detect_emotions(frame)
    if results:
        top_emotion = max(results[0]['emotions'], key=results[0]['emotions'].get)
        confidence = results[0]['emotions'][top_emotion]
    else:
        top_emotion, confidence = "neutral", 0.5

    return top_emotion, confidence
