from django.db import models
from django.utils import timezone
from core.models import User
import re
import logging
logger = logging.getLogger(__name__)
from organization.models import Organization, TenantModel


# Profile Model for Interview Roles
class Profile(TenantModel):
    """Represents different interview profiles/roles"""
    PROFILE_CHOICES = (
        ('frontend_developer', 'Frontend Developer'),
        ('fullstack_developer', 'Full Stack Developer'),
        ('java_developer', 'Java Developer'),
        ('python_developer', 'Python Developer'),
        ('mern_stack_developer', 'MERN Stack Developer'),
        ('data_scientist', 'Data Scientist'),
        ('devops_engineer', 'DevOps Engineer'),
        ('machine_learning_engineer', 'Machine Learning Engineer'),
        ('data_engineer', 'Data Engineer'),
        ('ai_engineer', 'AI Engineer'),
        ('ux_designer', 'UX Designer'),
        ('salesforce_developer', 'Salesforce Developer'),
        ('salesforce_admin', 'Salesforce Admin'),
        ('tableau_developer', 'Tableau Developer'),
        ('power_bi_developer', 'Power BI Developer'),
        ('data_analyst', 'Data Analyst'),
        ('backend_developer', 'Backend Developer'),
        ('mean_stack_developer', 'MEAN Stack Developer'),

    )
    
    name = models.CharField(max_length=100, unique=True)
    profile_key = models.CharField(max_length=50, choices=PROFILE_CHOICES, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name


# Hardcoded Questions Model
class Question(TenantModel):
    """Hardcoded interview questions that can be used in assessments"""
    COMPLEXITY_LEVELS = (
        ('fresher', 'Fresher'),
        ('0-2_years', '0-2 years'),
        ('2-5_years', '2-5 years'),
        ('5-8_years', '5-8 years'),
        ('8+_years', '8+ years'),
    )
    
    question = models.TextField(help_text="The interview question")
    complexity_level = models.CharField(max_length=20, choices=COMPLEXITY_LEVELS)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_questions')
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_questions')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['complexity_level', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.question[:80]}... ({self.complexity_level})"


# Many-to-Many: Questions to Profiles
class QuestionProfile(TenantModel):
    """Links questions to profiles"""
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='profile_links')
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='question_links')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('question', 'profile')
        ordering = ['profile', 'question']
    
    def __str__(self):
        return f"{self.question.question[:50]}... → {self.profile.name}"


# AI Assessment Models for Level 2 Interviews
class AIAssessment(TenantModel):
    INTERVIEW_ROLES = (
        ('frontend_developer', 'Frontend Developer'),
        ('fullstack_developer', 'Full Stack Developer'),
        ('java_developer', 'Java Developer'),
        ('python_developer', 'Python Developer'),
        ('mern_stack_developer', 'MERN Stack Developer'),
        ('data_scientist', 'Data Scientist'),
        ('devops_engineer', 'DevOps Engineer'),
        ('machine_learning_engineer', 'Machine Learning Engineer'),
        ('data_engineer', 'Data Engineer'),
        ('ai_engineer', 'AI Engineer'),
        ('ux_designer', 'UX Designer'),
        ('salesforce_developer', 'Salesforce Developer'),
        ('salesforce_admin', 'Salesforce Admin'),
        ('tableau_developer', 'Tableau Developer'),
        ('power_bi_developer', 'Power BI Developer'),
        ('data_analyst', 'Data Analyst'),
        ('backend_developer', 'Backend Developer'),
        ('mean_stack_developer', 'MEAN Stack Developer'),
    )
    
    EXPERIENCE_LEVELS = (
        ('fresher', 'Fresher'),
        ('0-2_years', '0-2 years'),
        ('2-5_years', '2-5 years'),
        ('5-8_years', '5-8 years'),
        ('8+_years', '8+ years'),
    )
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    role_type = models.CharField(max_length=50, choices=INTERVIEW_ROLES, default='frontend_developer')
    tech_stack = models.JSONField(default=list, blank=True, help_text="Skills/technologies this AI assessment targets.")
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_LEVELS, default='2-5_years')
    #duration = models.PositiveIntegerField(null=True, blank=True, help_text="Duration in minutes")
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    instructions = models.TextField(blank=True)
    num_questions = models.PositiveIntegerField(default=5, help_text="Total number of questions in assessment")
    num_hardcoded_questions = models.PositiveIntegerField(default=0, help_text="Number of hardcoded questions to include")
    hardcoded_question_ids = models.JSONField(default=list, blank=True, help_text="List of selected question IDs from question bank")
    num_coding_questions = models.PositiveIntegerField(default=0, help_text="Number of coding questions from question bank")
    coding_time_limit = models.PositiveIntegerField(default=10, help_text="Time limit per coding question in minutes")
    passing_percentage = models.FloatField(default=0, help_text="Minimum percentage (0-100) required to earn a certificate. 0 means no certificate.")
    is_global = models.BooleanField(default=False)
    visible_to_organizations = models.ManyToManyField(
        Organization,
        blank=True,
        related_name="shared_ai_assessments",
    )

    # AI Configuration
    gemini_api_key = models.CharField(max_length=500, blank=True, help_text="Gemini API key for this assessment")
    enable_voice_recording = models.BooleanField(default=True)
    enable_camera = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} - {self.get_role_type_display()}"
    
    def is_ongoing(self):
        now = timezone.now()
        return self.start_date <= now <= self.end_date
    
    def is_upcoming(self):
        return timezone.now() < self.start_date
    
    def is_expired(self):
        return timezone.now() > self.end_date

class CandidateAIAssessment(TenantModel):
    candidate = models.ForeignKey(User, on_delete=models.CASCADE)
    ai_assessment = models.ForeignKey(AIAssessment, on_delete=models.CASCADE)
    assigned_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_ai_assessments')
    assigned_date = models.DateTimeField(auto_now_add=True)
    
    # Candidate's resume/tech stack for AI question generation
    resume_text = models.TextField(help_text="Candidate's tech stack")
    
    # Interview session data
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=(
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ), default='assigned')
    
    # AI-generated questions and responses
    generated_questions = models.JSONField(default=list, blank=True)  # List of AI-generated questions
    questions_generation_status = models.CharField(max_length=20, choices=(
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ), default='pending', help_text="Status of question generation")
    
    # Scoring and feedback
    ai_feedback = models.TextField(blank=True)  # AI-generated feedback
    question_wise_verification = models.JSONField(default=list, blank=True)  # Detailed verification for each question
    technical_score = models.FloatField(default=0)
    communication_score = models.FloatField(default=0)
    problem_solving_score = models.FloatField(default=0)
    overall_score = models.FloatField(default=0)
    
    # Concise one-line feedback per field
    technical_feedback = models.TextField(blank=True, default='')
    communication_feedback = models.TextField(blank=True, default='')
    problem_solving_feedback = models.TextField(blank=True, default='')
    strengths_feedback = models.TextField(blank=True, default='')
    improvement_feedback = models.TextField(blank=True, default='')
    overall_feedback = models.TextField(blank=True, default='')
    
    # Video and screenshot storage (S3 URLs)
    introduction_video_url = models.URLField(max_length=500, blank=True, null=True, help_text="S3 URL for introduction video")
    introduction_video = models.FileField(upload_to='ai_introductions/', blank=True, null=True)  # Fallback for local storage
    
    assessment_video_url = models.URLField(max_length=500, blank=True, null=True, help_text="S3 URL for complete assessment recording")
    interview_video = models.FileField(upload_to='ai_videos/', blank=True, null=True)  
    interview_video_url = models.URLField(max_length=500, blank=True, null=True, help_text="S3 URL for interview recording")
    
    screenshots = models.JSONField(default=list, blank=True)  # List of screenshot S3 URLs with timestamps
    periodic_screenshots = models.JSONField(default=list, blank=True)  # List of periodic screenshot S3 URLs (every 5 min)
    
    # Gesture and communication analysis
    gesture_analysis = models.JSONField(default=dict, blank=True)  # MediaPipe analysis results
    communication_metrics = models.JSONField(default=dict, blank=True)  # Eye contact, posture, etc.
    # Cheating detection alerts
    cheating_alerts = models.JSONField(default=list, blank=True)  # List of detected violations
    voice_flow_analysis = models.JSONField(default=dict, blank=True)  # Aggregated voice-flow risk summary
    voice_flow_risk_score = models.FloatField(default=0)
    voice_flow_risk_level = models.CharField(
        max_length=10,
        choices=(('low', 'Low'), ('medium', 'Medium'), ('high', 'High')),
        default='low',
    )
    # Proctoring violation counters
    multiple_faces_count = models.IntegerField(default=0)
    gaze_violation_count = models.IntegerField(default=0)
    no_face_detection_count = models.IntegerField(default=0)
    total_proctor_warnings = models.IntegerField(default=0)
    admin_feedback = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.candidate.username} - {self.ai_assessment.title}"
    
    def calculate_scores_from_feedback(self, feedback_text):

        try:
            logger.info(
                "Starting score calculation",
                extra={
                    "candidate_assessment_id": self.id,
                }
            )

            # ---------------------------------------------------------
            # STEP 1: Extract question-wise verification
            # ---------------------------------------------------------
            self.question_wise_verification = self._extract_question_verification(
                feedback_text
            )

            logger.info(
                "Question-wise verification extracted",
                extra={
                    "verification_count": len(self.question_wise_verification or [])
                }
            )

            # ---------------------------------------------------------
            # STEP 2: Keep ONLY actually answered questions
            # ---------------------------------------------------------
            try:
                answered_qs = set(
                    self.aiinterviewresponse_set
                    .exclude(answer_text__isnull=True)
                    .exclude(answer_text='')
                    .values_list('question_number', flat=True)
                )

                if answered_qs:
                    original_count = len(self.question_wise_verification or [])

                    self.question_wise_verification = [
                        v for v in (self.question_wise_verification or [])
                        if v.get('question_number') in answered_qs
                    ]

                    logger.info(
                        "Filtered verification blocks",
                        extra={
                            "original_count": original_count,
                            "filtered_count": len(self.question_wise_verification),
                            "answered_questions": list(answered_qs)
                        }
                    )

            except Exception:
                logger.exception(
                    "Failed filtering question verification by answered questions"
                )

            # ---------------------------------------------------------
            # STEP 3: Extract AI category scores safely
            # ---------------------------------------------------------
            technical_match = re.search(
                r'Technical Competency.*?(?:Rating:\s*(\d+)|(\d+)/10)',
                feedback_text,
                re.IGNORECASE | re.DOTALL
            )

            communication_match = re.search(
                r'Communication Skills.*?(?:Rating:\s*(\d+)|(\d+)/10)',
                feedback_text,
                re.IGNORECASE | re.DOTALL
            )

            problem_solving_match = re.search(
                r'Problem-Solving Approach.*?(?:Rating:\s*(\d+)|(\d+)/10)',
                feedback_text,
                re.IGNORECASE | re.DOTALL
            )

            overall_match = re.search(
                r'Overall Assessment.*?(?:Rating:\s*(\d+)|(\d+)/10)',
                feedback_text,
                re.IGNORECASE | re.DOTALL
            )

            def extract_score(match):
                if not match:
                    return None

                try:
                    if match.group(1):
                        return float(match.group(1))

                    if match.group(2):
                        return float(match.group(2))

                except Exception:
                    logger.exception("Failed extracting score from regex match")

                return None

            ai_technical_score = extract_score(technical_match)
            ai_communication_score = extract_score(communication_match)
            ai_problem_solving_score = extract_score(problem_solving_match)
            #ai_overall_score = extract_score(overall_match)

            # ---------------------------------------------------------
            # STEP 4: Calculate overall score
            # ONLY THIS LOGIC CHANGED
            # ---------------------------------------------------------

            total_questions = len(self.generated_questions or [])

            if not total_questions:
                total_questions = self.ai_assessment.num_questions

            total_questions = max(total_questions, 1)

            answered_scores = []

            for verification in (self.question_wise_verification or []):

                raw_score = verification.get('score', 0)

                try:
                    if isinstance(raw_score, str):

                        score_match = re.search(
                            r'(\d+(?:\.\d+)?)',
                            raw_score
                        )

                        score = (
                            float(score_match.group(1))
                            if score_match else 0.0
                        )

                    else:
                        score = float(raw_score)

                except Exception:
                    logger.exception(
                        "Failed parsing question score",
                        extra={
                            "raw_score": raw_score
                        }
                    )
                    score = 0.0

                answered_scores.append(score)

            total_obtained_marks = sum(answered_scores)

            # ---------------------------------------------------------
            # FINAL OVERALL FORMULA
            # ---------------------------------------------------------
            self.overall_score = round(
                total_obtained_marks / total_questions,
                1
            )

            logger.info(
                "Overall score calculated",
                extra={
                    "total_obtained_marks": total_obtained_marks,
                    "total_questions": total_questions,
                    "answered_questions": len(answered_scores),
                    "unanswered_questions":
                        total_questions - len(answered_scores),
                    "overall_score": self.overall_score
                }
            )

            # ---------------------------------------------------------
            # STEP 5: Preserve original File 1 category logic
            # ---------------------------------------------------------
            preserve_ai_scores = (
                ai_technical_score is not None or
                ai_communication_score is not None or
                ai_problem_solving_score is not None
            )

            self._calculate_overall_scores_from_questions(
                preserve_ai_overall=True,
                preserve_ai_category_scores=preserve_ai_scores,
                ai_technical=ai_technical_score,
                ai_communication=ai_communication_score,
                ai_problem_solving=ai_problem_solving_score
            )

            if ai_technical_score is not None:
                self.technical_score = ai_technical_score

            if ai_communication_score is not None:
                self.communication_score = ai_communication_score

            if ai_problem_solving_score is not None:
                self.problem_solving_score = ai_problem_solving_score

            logger.info(
                "Category scores applied",
                extra={
                    "technical_score": self.technical_score,
                    "communication_score": self.communication_score,
                    "problem_solving_score": self.problem_solving_score
                }
            )

            # ---------------------------------------------------------
            # STEP 7: Extract concise feedback
            # ---------------------------------------------------------
            feedback_patterns = {
                'technical_feedback':
                    r'\*\*Technical Competency\*\*:\s*([^\n]+)',

                'communication_feedback':
                    r'\*\*Communication Skills\*\*:\s*([^\n]+)',

                'problem_solving_feedback':
                    r'\*\*Problem-Solving Approach\*\*:\s*([^\n]+)',

                'strengths_feedback':
                    r'\*\*Strengths\*\*:\s*([^\n]+)',

                'improvement_feedback':
                    r'\*\*Areas for Improvement\*\*:\s*([^\n]+)',

                'overall_feedback':
                    r'\*\*Overall Assessment\*\*:\s*([^\n]+)',
            }

            for field, pattern in feedback_patterns.items():

                try:
                    match = re.search(pattern, feedback_text)

                    if match:
                        cleaned_text = (
                            match.group(1)
                            .replace('Rating:', '')
                            .strip()
                        )

                        setattr(self, field, cleaned_text)

                except Exception:
                    logger.exception(
                        "Failed extracting feedback field",
                        extra={
                            "field": field
                        }
                    )
            self.save()

            logger.info(
                "Score calculation completed successfully",
                extra={
                    "candidate_assessment_id": self.id,
                    "overall_score": self.overall_score
                }
            )

        except Exception:
            logger.exception(
                "Critical error during score calculation",
                extra={
                    "candidate_assessment_id": self.id
                }
            )
            raise
    
    def _extract_question_verification(self, feedback_text):
        """Extract question-wise verification details from feedback"""
        import re
        
        logger.info(f"Extracting question-wise verification from feedback...")
        logger.info(f"   Feedback text length: {len(feedback_text)} characters")
        
        verification_data = []
        
        # Find the question-wise verification section - try multiple patterns
        verification_section = re.search(r'\*\*QUESTION-WISE VERIFICATION:\*\*(.*?)\*\*OVERALL ASSESSMENT:\*\*', 
                                       feedback_text, re.DOTALL)
        
        if not verification_section:
            # Try alternative pattern without bold markers
            verification_section = re.search(r'QUESTION-WISE VERIFICATION:(.*?)OVERALL ASSESSMENT:', 
                                           feedback_text, re.DOTALL | re.IGNORECASE)
        
        if not verification_section:
            logger.info(f"No QUESTION-WISE VERIFICATION section found in feedback")
            return verification_data
        
        logger.info(f"Found QUESTION-WISE VERIFICATION section")
        
        verification_content = verification_section.group(1).strip()
        
        # Parse each question block - try multiple patterns
        question_blocks = re.findall(r'Q(\d+):\s*(.*?)(?=Q\d+:|$)', verification_content, re.DOTALL)
        
        if not question_blocks:
            # Try alternative pattern with "Question" instead of "Q"
            question_blocks = re.findall(r'Question\s*(\d+):\s*(.*?)(?=Question\s*\d+:|$)', verification_content, re.DOTALL | re.IGNORECASE)
        
        logger.info(f"   Found {len(question_blocks)} question blocks to parse")
        
        for question_num, question_content in question_blocks:
            logger.info(f"   Processing Q{question_num}...")
            question_data = {
                'question_number': int(question_num),
                'question_text': '',
                'covered': [],
                'missing': [],
                'score': 0,
                'reason': ''
            }
            
            # Extract question text (first line)
            lines = question_content.strip().split('\n')
            if lines:
                question_data['question_text'] = lines[0].strip()
            
            # Extract covered items - try multiple patterns
            covered_match = re.search(r'✓ Covered:\s*(.*?)(?=✗|Score:|Missing:|$)', question_content, re.DOTALL)
            if not covered_match:
                # Try without checkmark
                covered_match = re.search(r'Covered:\s*(.*?)(?=Missing:|Score:|$)', question_content, re.DOTALL | re.IGNORECASE)
            
            if covered_match:
                covered_text = covered_match.group(1).strip()
                if covered_text and covered_text.lower() not in ['none', 'nothing', 'n/a']:
                    question_data['covered'] = [item.strip() for item in covered_text.split(',') if item.strip()]
            
            # Extract missing items - try multiple patterns
            missing_match = re.search(r'✗ Missing:\s*(.*?)(?=Score:|$)', question_content, re.DOTALL)
            if not missing_match:
                # Try without X mark
                missing_match = re.search(r'Missing:\s*(.*?)(?=Score:|$)', question_content, re.DOTALL | re.IGNORECASE)
            
            if missing_match:
                missing_text = missing_match.group(1).strip()
                if missing_text and missing_text.lower() not in ['none', 'nothing', 'n/a']:
                    question_data['missing'] = [item.strip() for item in missing_text.split(',') if item.strip()]
            
            # Extract score and reason - handle multiple formats
            # Try format: "Score: X/10 - reason"
            score_match = re.search(r'Score\s*:\s*(\d+(?:\.\d+)?)\s*/\s*10\s*-\s*(.*?)(?=\n|$)',question_content,re.IGNORECASE)
            if not score_match:
                # Try format: "Score: X/10" without reason
                score_match = re.search(r'Score\s*:\s*(\d+(?:\.\d+)?)\s*/\s*10',question_content,re.IGNORECASE)
            if not score_match:
                # Try generic X/10 pattern anywhere in the block
                score_match = re.search(r'(\d+(?:\.\d+)?)\s*/\s*10',question_content,re.IGNORECASE)
            
            if score_match:
                question_data['score'] = float(score_match.group(1))
                # Extract reason if available (group 2)
                if len(score_match.groups()) > 1 and score_match.group(2):
                    question_data['reason'] = score_match.group(2).strip()
                else:
                    # Try to find reason after score
                    reason_match = re.search(r'Score:\s*\d+/10\s*-\s*(.*?)(?=\n|$)', question_content)
                    if reason_match:
                        question_data['reason'] = reason_match.group(1).strip()
            
            verification_data.append(question_data)
            logger.info(f"Q{question_num} parsed - Score: {question_data['score']}/10, Covered: {len(question_data['covered'])}, Missing: {len(question_data['missing'])}")
        
        logger.info(f"Verification extraction completed: {len(verification_data)} questions processed")
        return verification_data

    def _calculate_overall_scores_from_questions(self, preserve_ai_overall=False, 
                                                 preserve_ai_category_scores=False,
                                                 ai_technical=None, ai_communication=None, ai_problem_solving=None):
        """Calculate category scores from individual question scores, accounting for unanswered questions"""
        if not self.question_wise_verification:
            logger.info("No question-wise verification data available for score calculation")
            return
        
        # Get total questions and answered questions
        total_questions = len(self.generated_questions or [])
        if not total_questions:
            total_questions = self.ai_assessment.num_questions
        
        answered_count = len(self.question_wise_verification)
        unanswered_count = max(total_questions - answered_count, 0)
        
        question_scores = []
        technical_scores = []
        communication_scores = []
        problem_solving_scores = []
        
        logger.info(f"\nCALCULATING CATEGORY SCORES FROM QUESTIONS:")
        logger.info(f"   Total questions: {total_questions}")
        logger.info(f"   Answered questions: {answered_count}")
        logger.info(f"   Unanswered questions: {unanswered_count}")
        if preserve_ai_overall:
            logger.info(f"   Preserving AI's overall score (AI already accounted for incomplete participation)")
        
        for verification in self.question_wise_verification:
            score = verification.get('score', 0)
            if isinstance(score, str):
                # Extract numeric score from "X/10" format
                import re
                score_match = re.search(r'(\d+(?:\.\d+)?)', score)
                score = float(score_match.group(1)) if score_match else 0
            
            question_scores.append(score)
            
            # Categorize questions based on content (this is a simple approach)
            question_text = (verification.get('question_text') or '').lower()
            
            # Technical questions (algorithms, data structures, technical concepts)
            if any(keyword in question_text for keyword in ['algorithm', 'data structure', 'technical', 'code', 'implementation', 'complexity', 'bias-variance', 'regularization', 'transfer learning']):
                technical_scores.append(score)
            
            # Communication questions (explanations, descriptions)
            if any(keyword in question_text for keyword in ['explain', 'describe', 'discuss', 'communication', 'present']):
                communication_scores.append(score)
            
            # Problem-solving questions (scenarios, troubleshooting)
            if any(keyword in question_text for keyword in ['problem', 'scenario', 'solution', 'approach', 'investigate', 'fraud detection', 'churn']):
                problem_solving_scores.append(score)
            
            logger.info(f"   Q{verification.get('question_number', '?')}: {score}/10 - {verification.get('question_text', '')[:50]}...")
        
        # Calculate completion rate
        completion_rate = answered_count / total_questions if total_questions > 0 else 0
        
        # Only calculate overall score if AI didn't provide one (or if preserve_ai_overall is False)
        if question_scores and not preserve_ai_overall:
            avg_overall = sum(question_scores) / len(question_scores)
            
            # Ensure minimum score based on participation
            # If they answered at least one question, give them credit
            if answered_count > 0:
                # Base score from answered questions
                base_score = avg_overall
                
                # Apply completion rate adjustment (but ensure minimum score)
                # Formula: base_score * completion_rate + (1 - completion_rate) * minimum_participation_score
                # This ensures even with low completion, they get some points
                minimum_participation_score = 1.0  # Minimum 1.0 points for attempting
                participation_bonus = minimum_participation_score * (1 - completion_rate)
                
                # Final score = base score weighted by completion + participation bonus
                final_overall = (base_score * completion_rate) + participation_bonus
                
                # Ensure it's at least the minimum participation score
                final_overall = max(minimum_participation_score, final_overall)
                
                # Cap at 10
                final_overall = min(10.0, final_overall)
            else:
                final_overall = 0.0
            
            self.overall_score = round(final_overall, 1)
            logger.info(f"   Overall Score: {self.overall_score}/10 (base: {avg_overall:.1f}, answered: {answered_count}/{total_questions}, completion: {completion_rate*100:.0f}%)")
        
        # Calculate category scores with participation credit
        # But preserve AI's extracted scores if provided (they already account for incomplete participation)
        minimum_category_score = 0.5  # Minimum 0.5 points per category if they answered any questions
        
        if preserve_ai_category_scores:
            # If AI provided category scores, don't recalculate - they already account for everything
            if ai_technical is not None:
                logger.info(f"   Technical Score: Preserving AI's score ({ai_technical}/10)")
            if ai_communication is not None:
                logger.info(f"   Communication Score: Preserving AI's score ({ai_communication}/10)")
            if ai_problem_solving is not None:
                logger.info(f"   Problem-Solving Score: Preserving AI's score ({ai_problem_solving}/10)")
        else:
            # Only calculate if AI didn't provide scores
            if technical_scores:
                avg_technical = sum(technical_scores) / len(technical_scores)
                # Weight by completion rate but ensure minimum
                final_technical = (avg_technical * completion_rate) + (minimum_category_score * (1 - completion_rate))
                final_technical = max(minimum_category_score, final_technical)
                final_technical = min(10.0, final_technical)
                self.technical_score = round(final_technical, 1)
                logger.info(f"   Technical Score: {self.technical_score}/10 (base: {avg_technical:.1f}, completion: {completion_rate*100:.0f}%)")
            elif answered_count > 0:
                # If they answered questions but none were technical, give minimum participation credit
                self.technical_score = round(minimum_category_score * completion_rate, 1)
                logger.info(f"   Technical Score: {self.technical_score}/10 (participation credit, completion: {completion_rate*100:.0f}%)")
            
            if communication_scores:
                avg_communication = sum(communication_scores) / len(communication_scores)
                final_communication = (avg_communication * completion_rate) + (minimum_category_score * (1 - completion_rate))
                final_communication = max(minimum_category_score, final_communication)
                final_communication = min(10.0, final_communication)
                self.communication_score = round(final_communication, 1)
                logger.info(f"   Communication Score: {self.communication_score}/10 (base: {avg_communication:.1f}, completion: {completion_rate*100:.0f}%)")
            elif answered_count > 0:
                self.communication_score = round(minimum_category_score * completion_rate, 1)
                logger.info(f"   Communication Score: {self.communication_score}/10 (participation credit, completion: {completion_rate*100:.0f}%)")
            
            if problem_solving_scores:
                avg_problem_solving = sum(problem_solving_scores) / len(problem_solving_scores)
                final_problem_solving = (avg_problem_solving * completion_rate) + (minimum_category_score * (1 - completion_rate))
                final_problem_solving = max(minimum_category_score, final_problem_solving)
                final_problem_solving = min(10.0, final_problem_solving)
                self.problem_solving_score = round(final_problem_solving, 1)
                logger.info(f"   Problem-Solving Score: {self.problem_solving_score}/10 (base: {avg_problem_solving:.1f}, completion: {completion_rate*100:.0f}%)")
            elif answered_count > 0:
                self.problem_solving_score = round(minimum_category_score * completion_rate, 1)
                logger.info(f"   Problem-Solving Score: {self.problem_solving_score}/10 (participation credit, completion: {completion_rate*100:.0f}%)")

        logger.info(f"SCORE BREAKDOWN COMPLETE\n")

class AIInterviewResponse(TenantModel):
    candidate_assessment = models.ForeignKey(CandidateAIAssessment, on_delete=models.CASCADE)
    question_number = models.PositiveIntegerField()
    question_text = models.TextField()
    answer_text = models.TextField(blank=True)
    voice_recording_path = models.CharField(max_length=500, blank=True)  # Path to voice recording file
    audio_recording = models.FileField(upload_to='ai_audio/', blank=True, null=True)  # Uploaded mic audio
    response_time = models.PositiveIntegerField(default=0)  # Time taken to answer in seconds
    responded_at = models.DateTimeField(auto_now=True)

    # Coding question fields
    question_type = models.CharField(max_length=10, default='text')
    code_answer = models.TextField(blank=True, default='')
    code_language = models.CharField(max_length=20, blank=True, default='')
    code_execution_results = models.JSONField(default=list, blank=True)
    code_marks_earned = models.FloatField(default=0)
    code_marks_total = models.FloatField(default=0)
    coding_question_id = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('candidate_assessment', 'question_number')
        ordering = ['question_number']


class AIVoiceAnalysis(TenantModel):
    RISK_LEVELS = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    )

    candidate_assessment = models.ForeignKey(
        CandidateAIAssessment,
        on_delete=models.CASCADE,
        related_name='voice_analyses',
    )
    response = models.OneToOneField(
        AIInterviewResponse,
        on_delete=models.CASCADE,
        related_name='voice_analysis',
    )
    question_number = models.PositiveIntegerField()
    audio_duration_seconds = models.FloatField(default=0)
    transcript_word_count = models.PositiveIntegerField(default=0)
    speech_rate_wpm = models.FloatField(default=0)
    pause_count = models.PositiveIntegerField(default=0)
    long_pause_count = models.PositiveIntegerField(default=0)
    longest_pause_seconds = models.FloatField(default=0)
    pause_timeline = models.JSONField(default=list, blank=True)
    speech_rate_timeline = models.JSONField(default=list, blank=True)
    filler_word_count = models.PositiveIntegerField(default=0)
    sentence_complexity_delta = models.FloatField(default=0)
    answer_structure_score = models.FloatField(default=0)
    mid_answer_shift_score = models.FloatField(default=0)
    llm_consistency_score = models.FloatField(default=0)
    overall_risk_score = models.FloatField(default=0)
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS, default='low')
    signals = models.JSONField(default=list, blank=True)
    llm_review = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('candidate_assessment', 'question_number')
        ordering = ['question_number']
        indexes = [
            models.Index(fields=['candidate_assessment', 'risk_level']),
            models.Index(fields=['overall_risk_score']),
        ]

    def __str__(self):
        return (
            f"{self.candidate_assessment_id} Q{self.question_number} "
            f"{self.risk_level} ({self.overall_risk_score:.1f})"
        )
