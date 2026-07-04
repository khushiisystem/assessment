"""
Proctoring System with Haar Cascades and MediaPipe
- Multiple Face Detection: Haar Cascades
- Phone Detection: MediaPipe Hand Detection
- Looking Away Detection: Face tracking
"""

import cv2
import numpy as np
from typing import Dict, List, Optional
import base64
from io import BytesIO
from PIL import Image
import logging
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Try to import MediaPipe for phone detection
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logger.warning("MediaPipe not available - phone detection will be limited")

class SimpleCheatingDetector:
    """Proctoring detector using Haar Cascades + MediaPipe"""
    
    def __init__(self):
        """Initialize Haar Cascades and MediaPipe"""
        try:
            # Get OpenCV's built-in Haar Cascade path
            cascade_path = cv2.data.haarcascades
            
            # Load face detector (for multiple face detection)
            face_cascade_file = os.path.join(cascade_path, 'haarcascade_frontalface_default.xml')
            self.face_cascade = cv2.CascadeClassifier(face_cascade_file)
            
            # Load profile face detector (for side faces)
            profile_cascade_file = os.path.join(cascade_path, 'haarcascade_profileface.xml')
            self.profile_cascade = cv2.CascadeClassifier(profile_cascade_file)
            
            self.available = not self.face_cascade.empty()
            
            # Initialize MediaPipe Hands for phone detection
            if MEDIAPIPE_AVAILABLE:
                self.mp_hands = mp.solutions.hands
                self.hands = self.mp_hands.Hands(
                    static_image_mode=True,
                    max_num_hands=2,
                    min_detection_confidence=0.5
                )
                logger.info("✅ MediaPipe Hands initialized for phone detection")
            else:
                self.hands = None
                logger.warning("⚠️ MediaPipe not available - phone detection disabled")
            
            if self.available:
                logger.info("✅ OpenCV Haar Cascades loaded successfully")
            else:
                logger.error("❌ Failed to load Haar Cascades")
                
        except Exception as e:
            logger.error(f"❌ Initialization error: {e}")
            self.available = False
            self.hands = None
    
    def analyze_frame(self, image_data: str) -> Dict:
        """
        Analyze frame for cheating detection
        
        Returns:
            {
                'status': 'success',
                'alerts': [...],
                'analysis': {...}
            }
        """
        if not self.available:
            logger.warning("OpenCV not available, returning mock data")
            return self._mock_analysis()
        
        try:
            # Decode image
            image = self._decode_image(image_data)
            if image is None:
                return self._mock_analysis()
            
            # Convert to grayscale for detection
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply histogram equalization to improve detection in varying lighting
            gray = cv2.equalizeHist(gray)
            
            # Detect frontal faces with optimized parameters for better accuracy
            # scaleFactor: 1.1 = more sensitive (detects more faces, including smaller ones)
            # minNeighbors: 5 = balanced (not too strict, not too loose)
            # minSize: 40x40 = reasonable minimum face size
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,  # More sensitive to detect faces at various distances
                minNeighbors=5,   # Balanced to reduce false positives while catching real faces
                minSize=(40, 40), # Reasonable minimum size
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            # Detect profile faces (side-facing) with similar parameters
            profile_faces = self.profile_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(40, 40),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            # Remove overlapping detections between frontal and profile
            def is_overlapping(box1, box2, threshold=0.5):
                """Check if two bounding boxes overlap significantly"""
                x1, y1, w1, h1 = box1
                x2, y2, w2, h2 = box2
                
                # Calculate intersection
                x_left = max(x1, x2)
                y_top = max(y1, y2)
                x_right = min(x1 + w1, x2 + w2)
                y_bottom = min(y1 + h1, y2 + h2)
                
                if x_right < x_left or y_bottom < y_top:
                    return False
                
                intersection_area = (x_right - x_left) * (y_bottom - y_top)
                box1_area = w1 * h1
                box2_area = w2 * h2
                
                # Check if intersection is significant relative to smaller box
                overlap_ratio = intersection_area / min(box1_area, box2_area)
                return overlap_ratio > threshold
            
            # Filter out overlapping profile faces
            unique_faces = list(faces)
            for pface in profile_faces:
                is_duplicate = False
                for face in faces:
                    if is_overlapping(face, pface):
                        is_duplicate = True
                        break
                if not is_duplicate:
                    unique_faces.append(pface)
            
            total_faces = len(unique_faces)
            
            # Detect phone usage using MediaPipe Hands
            phone_detected = False
            if self.hands and total_faces == 1:
                # Convert BGR to RGB for MediaPipe
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = self.hands.process(image_rgb)
                
                if results.multi_hand_landmarks:
                    num_hands = len(results.multi_hand_landmarks)
                    
                    # Phone usage detected if hands are near face (holding phone)
                    if num_hands >= 1:
                        # Check if hand is in upper part of frame (near face)
                        for hand_landmarks in results.multi_hand_landmarks:
                            # Get wrist position (landmark 0)
                            wrist_y = hand_landmarks.landmark[0].y
                            
                            # If hand is in upper 60% of frame, likely holding phone
                            if wrist_y < 0.6:
                                phone_detected = True
                                logger.warning(f"🚨 PHONE DETECTED: Hand near face (MediaPipe)")
                                break
            
            # Build analysis
            analysis = {
                'timestamp': datetime.now().isoformat(),
                'num_faces': total_faces,
                'face_detected': total_faces > 0,
                'phone_detected': phone_detected,
                'alerts': [],
                'bounding_boxes': []
            }
            
            # ALERT 1: Multiple faces detected (Haar Cascades)
            if total_faces > 1:
                            # Calculate number of multiple faces detected
                multiple_faces_detected = max(total_faces - 1, 0)  # Only count if more than 1 face

                # Count gaze violations (no face detected = candidate looking away)
                gaze_violations = 1 if total_faces == 0 else 0

                # Total warnings
                total_warnings = multiple_faces_detected + gaze_violations

                # Add these to the analysis dict so the frontend can use them
                analysis['multiple_faces_detected'] = multiple_faces_detected
                analysis['gaze_violations'] = gaze_violations
                analysis['total_warnings'] = total_warnings

                logger.warning(f"🚨 MULTIPLE FACES DETECTED: {total_faces} faces")
                
                analysis['alerts'].append({
                    'type': 'multiple_faces',
                    'severity': 'high',
                    'message': f'Multiple people detected ({total_faces} faces)',
                    'confidence': 0.9,
                    'timestamp': datetime.now().isoformat()
                })
                
                # Add bounding boxes for all faces
                for (x, y, w, h) in unique_faces:
                    analysis['bounding_boxes'].append({
                        'type': 'face',
                        'x': float(x / image.shape[1]),
                        'y': float(y / image.shape[0]),
                        'width': float(w / image.shape[1]),
                        'height': float(h / image.shape[0])
                    })
            
            # ALERT 2: Phone detection (MediaPipe)
            if phone_detected:
                analysis['alerts'].append({
                    'type': 'phone_usage',
                    'severity': 'high',
                    'message': 'Phone usage detected - hand near face',
                    'confidence': 0.9,
                    'timestamp': datetime.now().isoformat()
                })
            
            # ALERT 3: No face detected (looking away)
            if total_faces == 0:
                logger.warning("⚠️ NO FACE DETECTED - Looking away")
                
                analysis['alerts'].append({
                    'type': 'looking_away',
                    'severity': 'medium',
                    'message': 'Candidate not looking at camera',
                    'confidence': 0.8,
                    'timestamp': datetime.now().isoformat()
                })
            
            # Calculate engagement score
            engagement = 0.5
            if total_faces == 1:
                engagement += 0.4
            if not phone_detected:
                engagement += 0.1
            
            analysis['engagement_score'] = min(1.0, engagement)
            analysis['posture_score'] = 0.7 if total_faces == 1 else 0.3
            
            logger.info(f"✅ Analysis complete: {total_faces} faces, phone={phone_detected}, {len(analysis['alerts'])} alerts")
            
            return {
                'status': 'success',
                'analysis': analysis,
                'alerts': analysis['alerts']
            }
            
        except Exception as e:
            logger.error(f"❌ Error in analyze_frame: {e}")
            return self._mock_analysis()
    
    def _decode_image(self, image_data: str) -> Optional[np.ndarray]:
        """Decode base64 image to numpy array"""
        try:
            # Remove data URL prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            image = Image.open(BytesIO(image_bytes))
            
            # Convert to numpy array
            image_np = np.array(image)
            
            # Convert RGB to BGR for OpenCV
            if len(image_np.shape) == 3 and image_np.shape[2] == 3:
                image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
            
            return image_np
            
        except Exception as e:
            logger.error(f"Error decoding image: {e}")
            return None
    
    def _mock_analysis(self) -> Dict:
        """Return mock analysis when detection is not available"""
        return {
            'status': 'success',
            'analysis': {
                'timestamp': datetime.now().isoformat(),
                'num_faces': 1,
                'face_detected': True,
                'phone_detected': False,
                'alerts': [],
                'bounding_boxes': [],
                'engagement_score': 0.7,
                'posture_score': 0.7
            },
            'alerts': []
        }


def get_detector():
    """Factory function to get detector instance"""
    return SimpleCheatingDetector()
