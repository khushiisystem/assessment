from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from .models import User, Question, Assessment, Category

class CustomUserCreationForm(UserCreationForm):
    phone = forms.CharField(
        max_length=10,
        min_length=10,
        required=True,
        validators=[
            RegexValidator(
                regex=r'^\d{10}$',
                message='Enter a valid 10-digit phone number.'
            )
        ],
        error_messages={'required': 'Phone number is required.'}
    )

    first_name = forms.CharField(
        max_length=30,
        required=True,
        error_messages={'required': 'First name is required.'}
    )

    # ✅ Add new fields properly
    resume = forms.FileField(required=False, label="Resume (PDF/DOC/DOCX)",)
    profile = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'rows': 3, 'placeholder': "Enter candidate's short profile..."}),
        label="Profile / About"
    )

    class Meta:
        model = User
        fields = (
            'username', 'email', 'first_name', 'last_name',
            'phone', 'profile'
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make password fields optional (will be auto-generated)
        self.fields['password1'].required = False
        self.fields['password2'].required = False
        # Hide role field (auto set to candidate in save)
        if 'role' in self.fields:
            self.fields.pop('role')

    # ✅ Email must be unique
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("This email address is already in use.")
        return email

    # ✅ Phone must be unique
    def clean_phone(self):
        phone = self.cleaned_data.get('phone')
        if User.objects.filter(phone=phone).exists():
            raise ValidationError("This phone number is already registered.")
        return phone

    def save(self, commit=True):
        user = super().save(commit=False)
        user.role = 'candidate'  # Always set role to candidate
        
        # If password not provided, it will be set in the view
        # Don't call save here if commit=False
        if commit:
            # Only save if password is set
            if user.password:
                user.save()
            else:
                # Password will be set by the view
                pass
        return user
    
    
class CustomAuthenticationForm(AuthenticationForm):
    username = forms.CharField(widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Username'}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Password'}))

class QuestionForm(forms.ModelForm):
    class Meta:
        model = Question
        fields = '__all__'
        exclude = ['created_by']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'category': forms.Select(attrs={'class': 'form-control'}),
            'difficulty': forms.Select(attrs={'class': 'form-control'}),
            'question_type': forms.Select(attrs={'class': 'form-control'}),
            'marks': forms.NumberInput(attrs={'class': 'form-control'}),
            'option1': forms.TextInput(attrs={'class': 'form-control'}),
            'option2': forms.TextInput(attrs={'class': 'form-control'}),
            'option3': forms.TextInput(attrs={'class': 'form-control'}),
            'option4': forms.TextInput(attrs={'class': 'form-control'}),
            'option5': forms.TextInput(attrs={'class': 'form-control'}),
            'correct_answer': forms.TextInput(attrs={'class': 'form-control'}),
            'tags': forms.TextInput(attrs={'class': 'form-control'}),
            'sample_input': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'sample_output': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
        }

    def clean(self):
        cleaned = super().clean()
        qtype = cleaned.get('question_type')

        # MCQ types
        MCQ_TYPES = {'mcq_single', 'mcq_multiple', 'true_false'}

        # 2a) Non-MCQ (coding/sql/subjective/fill) par MCQ fields optional/clear
        if qtype not in MCQ_TYPES:
            # correct_answer not required for coding/sql/etc.
            # (Optional) clear MCQ options so they don't fail unique/blank checks later
            for f in ['option1', 'option2', 'option3', 'option4']:
                if f in self.fields:
                    cleaned[f] = cleaned.get(f) or ''
            # don't force correct_answer
            # if your model has blank=False on correct_answer, either set blank=True in model
            # or here ensure it's at least empty string
            if 'correct_answer' in self.fields:
                cleaned['correct_answer'] = cleaned.get('correct_answer') or ''

        # 2b) MCQ types par strict checks as before
        else:
            # Example: ensure options present
            opts = [cleaned.get('option1'), cleaned.get('option2'),
                    cleaned.get('option3'), cleaned.get('option4')]
            if qtype in {'mcq_single', 'mcq_multiple'} and not all(opts[:2]):  # at least 1-2
                self.add_error('option1', 'Option 1 is required.')
                self.add_error('option2', 'Option 2 is required.')
            # correct_answer required for MCQ
            ca = (cleaned.get('correct_answer') or '').strip()
            if not ca:
                self.add_error('correct_answer', 'Correct answer is required for MCQ.')

        return cleaned

class AssessmentForm(forms.ModelForm):
    categories = forms.ModelMultipleChoiceField(
        queryset=Category.objects.all(),
        # widget=forms.CheckboxSelectMultiple,
        widget=forms.SelectMultiple(attrs={'class': 'form-select'}),
        required=False
    )
    
    class Meta:
        model = Assessment
        fields = '__all__'
        exclude = ['created_by', 'questions']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'duration': forms.NumberInput(attrs={'class': 'form-control'}),
            'start_date': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'end_date': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'instructions': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'shuffle_questions': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'shuffle_options': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Default both toggles to OFF
        self.fields['shuffle_questions'].initial = False
        self.fields['shuffle_options'].initial = False

class BulkUploadForm(forms.Form):
    file = forms.FileField(label='Select CSV/Excel File')
    model_type = forms.ChoiceField(choices=(
        ('candidate', 'Candidates'),
        ('question', 'Questions'),
    ), widget=forms.Select(attrs={'class': 'form-control'}))


# Candidate Registration Forms
class CandidateRegistrationForm(forms.Form):
    """Step 1: Candidate fills basic details"""
    first_name = forms.CharField(
        max_length=30,
        required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter your first name'})
    )
    last_name = forms.CharField(
        max_length=30,
        required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter your last name'})
    )
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Enter your email'})
    )
    phone = forms.CharField(
        max_length=10,
        min_length=10,
        required=True,
        validators=[
            RegexValidator(
                regex=r'^\d{10}$',
                message='Enter a valid 10-digit phone number.'
            )
        ],
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter 10-digit mobile number'})
    )
    resume = forms.FileField(
        required=True,
        widget=forms.FileInput(attrs={
            'class': 'form-control', 
            'accept': '.pdf',
            'placeholder': 'Upload your resume (PDF only)'
        }),
        help_text="Upload your resume in PDF format only (Max 5MB)"
    )
    profile = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control', 
            'rows': 3, 
            'placeholder': 'Tell us about your skills and experience (optional)'
        })
    )
    
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("This email is already registered. Please use a different email or try login.")
        return email.lower()
    
    def clean_phone(self):
        phone = self.cleaned_data.get('phone')
        if User.objects.filter(phone=phone).exists():
            raise ValidationError("This phone number is already registered. Please use a different number or try login.")
        return phone
    
    def clean_resume(self):
        resume = self.cleaned_data.get('resume')
        if resume:
            # Check file extension
            if not resume.name.lower().endswith('.pdf'):
                raise ValidationError("Only PDF files are allowed for resume upload.")
            
            # Check file size (5MB limit)
            if resume.size > 5 * 1024 * 1024:  # 5MB in bytes
                raise ValidationError("Resume file size must be less than 5MB.")
            
            # Check if it's actually a PDF file (basic check)
            if not resume.content_type == 'application/pdf':
                raise ValidationError("Invalid PDF file. Please upload a valid PDF document.")
        
        return resume


class OTPVerificationForm(forms.Form):
    """Step 2: OTP verification"""
    otp_code = forms.CharField(
        max_length=6,
        min_length=6,
        required=True,
        validators=[
            RegexValidator(
                regex=r'^\d{6}$',
                message='Enter a valid 6-digit OTP.'
            )
        ],
        widget=forms.TextInput(attrs={
            'class': 'form-control text-center', 
            'placeholder': 'Enter 6-digit OTP',
            'style': 'font-size: 1.2em; letter-spacing: 0.2em;'
        })
    )


class ForgotPasswordForm(forms.Form):
    """Forgot password - enter phone/email"""
    contact = forms.CharField(
        max_length=50,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Enter your phone number or email'
        }),
        help_text="Enter the phone number or email you used during registration"
    )
    
    def clean_contact(self):
        contact = self.cleaned_data.get('contact').strip()
        
        # Check if it's email or phone
        if '@' in contact:
            # It's email
            if not User.objects.filter(email__iexact=contact, role='candidate').exists():
                raise ValidationError("No candidate account found with this email.")
        else:
            # It's phone
            if not contact.isdigit() or len(contact) != 10:
                raise ValidationError("Please enter a valid 10-digit phone number or email.")
            if not User.objects.filter(phone=contact, role='candidate').exists():
                raise ValidationError("No candidate account found with this phone number.")
        
        return contact


class ResetPasswordForm(forms.Form):
    """Reset password after OTP verification"""
    new_password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Enter new password'
        }),
        help_text="Password must be at least 8 characters long"
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Confirm new password'
        })
    )
    
    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('new_password')
        confirm = cleaned_data.get('confirm_password')
        
        if password and confirm and password != confirm:
            raise ValidationError("Passwords do not match.")
        
        return cleaned_data


class CandidateProfileForm(forms.ModelForm):
    """Candidate profile edit form"""
    resume = forms.FileField(
        required=False,
        widget=forms.FileInput(attrs={
            'class': 'form-control', 
            'accept': '.pdf',
        }),
        help_text="Upload new resume in PDF format only (Max 5MB) - Leave empty to keep current resume"
    )
    
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone', 'profile']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'phone': forms.TextInput(attrs={'class': 'form-control'}),
            'profile': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
        }
    
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if self.instance and User.objects.filter(email__iexact=email).exclude(id=self.instance.id).exists():
            raise ValidationError("This email is already in use by another account.")
        return email.lower()
    
    def clean_phone(self):
        phone = self.cleaned_data.get('phone')
        if self.instance and User.objects.filter(phone=phone).exclude(id=self.instance.id).exists():
            raise ValidationError("This phone number is already in use by another account.")
        return phone
    
    def clean_resume(self):
        resume = self.cleaned_data.get('resume')
        if resume:
            # Check file extension
            if not resume.name.lower().endswith('.pdf'):
                raise ValidationError("Only PDF files are allowed for resume upload.")
            
            # Check file size (5MB limit)
            if resume.size > 5 * 1024 * 1024:  # 5MB in bytes
                raise ValidationError("Resume file size must be less than 5MB.")
            
            # Check if it's actually a PDF file (basic check)
            if not resume.content_type == 'application/pdf':
                raise ValidationError("Invalid PDF file. Please upload a valid PDF document.")
        
        return resume


class ChangePasswordForm(forms.Form):
    """Change password form for logged-in candidates"""
    current_password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Enter current password'
        })
    )
    new_password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Enter new password'
        }),
        help_text="Password must be at least 8 characters long"
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Confirm new password'
        })
    )
    
    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
    
    def clean_current_password(self):
        password = self.cleaned_data.get('current_password')
        if not self.user.check_password(password):
            raise ValidationError("Current password is incorrect.")
        return password
    
    def clean(self):
        cleaned_data = super().clean()
        new_password = cleaned_data.get('new_password')
        confirm = cleaned_data.get('confirm_password')
        
        if new_password and confirm and new_password != confirm:
            raise ValidationError("New passwords do not match.")
        
        return cleaned_data