"""
AWS S3 Storage Utilities for handling video and image uploads
Folder structure: bucket/candidate_email/introduction_video|assessment_video|proctoring_images|periodic_images
"""
import os
import boto3
from botocore.exceptions import ClientError
from django.conf import settings
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class S3StorageHandler:
    """Handle S3 uploads with organized folder structure per candidate"""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
        )
        self.bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')
    
    def _get_candidate_folder_path(self, candidate_email, subfolder):
        """
        Generate S3 path: bucket/candidate_email/subfolder/
        
        Args:
            candidate_email: Email of the candidate
            subfolder: One of 'introduction_video', 'assessment_video', 'proctoring_images', 'periodic_images'
        
        Returns:
            str: S3 folder path
        """
        return f"{candidate_email}/{subfolder}/"
    
    def upload_file(self, file_obj, candidate_email, subfolder, filename=None):
        """
        Upload a file to S3 in the candidate's folder structure
        
        Args:
            file_obj: File object or file path
            candidate_email: Email of the candidate
            subfolder: Subfolder name (introduction_video, assessment_video, etc.)
            filename: Optional custom filename (auto-generated if not provided)
        
        Returns:
            str: S3 URL of uploaded file or None if failed
        """
        try:
            if not self.bucket_name:
                logger.error("AWS_STORAGE_BUCKET_NAME not configured")
                return None
            
            # Generate filename if not provided
            if not filename:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                if hasattr(file_obj, 'name'):
                    ext = os.path.splitext(file_obj.name)[1]
                    filename = f"{timestamp}{ext}"
                else:
                    filename = f"{timestamp}.bin"
            
            # Construct S3 key
            s3_key = self._get_candidate_folder_path(candidate_email, subfolder) + filename
            
            # Upload file without ACL (bucket has ACLs disabled)
            extra_args = {}
            if s3_key.endswith('.webm'):
                extra_args['ContentType'] = 'video/webm'
            elif s3_key.endswith('.jpg') or s3_key.endswith('.jpeg'):
                extra_args['ContentType'] = 'image/jpeg'
            elif s3_key.endswith('.png'):
                extra_args['ContentType'] = 'image/png'
            elif s3_key.endswith('.gif'):
                extra_args['ContentType'] = 'image/gif'
            elif s3_key.endswith('.webp'):
                extra_args['ContentType'] = 'image/webp'
            else:
                # Try to determine from file object if available
                if hasattr(file_obj, 'content_type'):
                    extra_args['ContentType'] = file_obj.content_type
            
            if isinstance(file_obj, str):
                # File path provided
                self.s3_client.upload_file(file_obj, self.bucket_name, s3_key, ExtraArgs=extra_args)
            else:
                # File object provided
                self.s3_client.upload_fileobj(file_obj, self.bucket_name, s3_key, ExtraArgs=extra_args)
            
            # Generate URL
            s3_url = f"https://{self.bucket_name}.s3.{self.s3_client.meta.region_name}.amazonaws.com/{s3_key}"
            logger.info(f"Successfully uploaded file to S3: {s3_url}")
            return s3_url
            
        except ClientError as e:
            logger.error(f"Failed to upload file to S3: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during S3 upload: {str(e)}")
            return None
    
    def upload_introduction_video(self, video_file, candidate_email, filename=None):
        """Upload introduction video to S3"""
        return self.upload_file(video_file, candidate_email, 'introduction_video', filename)
    
    def upload_assessment_video(self, video_file, candidate_email, assessment_id, filename=None):
        """Upload complete assessment recording to S3"""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"assessment_{assessment_id}_{timestamp}.webm"
        return self.upload_file(video_file, candidate_email, 'assessment_video', filename)
    
    def upload_proctoring_image(self, image_file, candidate_email, incident_type, filename=None):
        """Upload proctoring screenshot to S3"""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"proctoring_{incident_type}_{timestamp}.jpg"
        return self.upload_file(image_file, candidate_email, 'proctoring_images', filename)
    
    def upload_periodic_image(self, image_file, candidate_email, filename=None):
        """Upload periodic screenshot (every 5 min) to S3"""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"periodic_{timestamp}.jpg"
        return self.upload_file(image_file, candidate_email, 'periodic_images', filename)
    
    def upload_avatar(self, avatar_file, candidate_email, filename=None):
        """Upload avatar image to S3"""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            if hasattr(avatar_file, 'name'):
                ext = os.path.splitext(avatar_file.name)[1]
                filename = f"avatar_{timestamp}{ext}"
            else:
                filename = f"avatar_{timestamp}.jpg"
        return self.upload_file(avatar_file, candidate_email, 'avatars', filename)
    
    def delete_file(self, s3_url):
        """Delete a file from S3 using its URL"""
        try:
            # Extract key from URL
            s3_key = s3_url.split(f"{self.bucket_name}.s3.amazonaws.com/")[1]
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            logger.info(f"Successfully deleted file from S3: {s3_url}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from S3: {str(e)}")
            return False
    
    def list_candidate_files(self, candidate_email, subfolder=None):
        """List all files for a candidate (optionally in a specific subfolder)"""
        try:
            prefix = f"{candidate_email}/"
            if subfolder:
                prefix += f"{subfolder}/"
            
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    files.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'],
                        'url': f"https://{self.bucket_name}.s3.amazonaws.com/{obj['Key']}"
                    })
            
            return files
        except Exception as e:
            logger.error(f"Failed to list files from S3: {str(e)}")
            return []


# Singleton instance
s3_handler = S3StorageHandler()
