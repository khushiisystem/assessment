from django import forms
from core.models import User
from .models import AIAssessment, CandidateAIAssessment, Question, Profile, QuestionProfile
import csv
import openpyxl

# Bulk Upload Questions Form
class BulkUploadQuestionsForm(forms.Form):
    """Form for bulk uploading questions via CSV or Excel"""
    UPLOAD_FORMAT_CHOICES = [
        ('csv', 'CSV (.csv)'),
        ('excel', 'Excel (.xlsx)'),
    ]
    
    file_format = forms.ChoiceField(
        choices=UPLOAD_FORMAT_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        label="Select File Format",
        initial='csv'
    )
    
    file = forms.FileField(
        widget=forms.FileInput(attrs={
            'class': 'form-control',
            'accept': '.csv,.xlsx',
            'id': 'questionFile'
        }),
        label="Upload Questions File",
        help_text="Upload CSV or Excel file with questions"
    )
    
    skip_errors = forms.BooleanField(
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        label="Skip rows with errors and continue",
        help_text="If checked, invalid rows will be skipped. If unchecked, upload will stop on first error."
    )
    
    def clean_file(self):
        file = self.cleaned_data.get('file')
        if file:
            # Check file size (max 5MB)
            if file.size > 5 * 1024 * 1024:
                raise forms.ValidationError("File size must be less than 5MB")
            
            # Check file extension
            file_format = self.cleaned_data.get('file_format')
            if file_format == 'csv' and not file.name.endswith('.csv'):
                raise forms.ValidationError("Please upload a CSV file")
            elif file_format == 'excel' and not file.name.endswith('.xlsx'):
                raise forms.ValidationError("Please upload an Excel file")
        
        return file


# AI Assessment Forms
class AIAssessmentForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in ['duration', 'gemini_api_key']:
            if field in self.fields:
                del self.fields[field]

    def clean(self):
        cleaned_data = super().clean()
        total = cleaned_data.get('num_questions', 0) or 0
        hardcoded = cleaned_data.get('num_hardcoded_questions', 0) or 0
        coding = cleaned_data.get('num_coding_questions', 0) or 0
        if hardcoded + coding > total:
            raise forms.ValidationError(
                "Hardcoded text questions + coding questions cannot exceed total questions."
            )
        return cleaned_data

    class Meta:
        model = AIAssessment
        fields = '__all__'
        exclude = ['created_by', 'duration', 'gemini_api_key']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter assessment title'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Describe the AI assessment'}),
            'role_type': forms.Select(attrs={'class': 'form-control'}),
            'experience_level': forms.Select(attrs={'class': 'form-control'}),
            'start_date': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'end_date': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'instructions': forms.Textarea(attrs={'class': 'form-control', 'rows': 4, 'placeholder': 'Instructions for candidates'}),
            'num_questions': forms.NumberInput(attrs={'class': 'form-control', 'min': '1', 'value': '5'}),
            'num_hardcoded_questions': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'value': '0', 'placeholder': 'Number of hardcoded questions'}),
            'num_coding_questions': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'value': '0', 'placeholder': 'Number of coding questions'}),
            'coding_time_limit': forms.NumberInput(attrs={'class': 'form-control', 'min': '1', 'value': '10', 'placeholder': 'Minutes per coding question'}),
            'enable_voice_recording': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'enable_camera': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

class AssignAIAssessmentForm(forms.ModelForm):
    candidates = forms.ModelMultipleChoiceField(
        queryset=User.objects.filter(role='candidate'),
        widget=forms.CheckboxSelectMultiple(attrs={'class': 'form-check-input'}),
        required=True
    )
    
    class Meta:
        model = CandidateAIAssessment
        fields = ['resume_text']
        widgets = {
            'resume_text': forms.Textarea(attrs={
                'class': 'form-control', 
                'rows': 6, 
                'placeholder': 'Enter candidate resume/tech stack for AI question generation...\n\nExample:\nPython, JavaScript, React, Node.js, 3 years experience in web development, worked on e-commerce platforms, familiar with AWS, Docker, MongoDB...'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['resume_text'].label = "Resume/Tech Stack"
        self.fields['resume_text'].help_text = "This will be used by AI to generate personalized interview questions"


# Question Management Form
class QuestionForm(forms.ModelForm):
    class Meta:
        model = Question
        fields = ['question', 'complexity_level', 'is_active']
        widgets = {
            'question': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Enter the interview question...'
            }),
            'complexity_level': forms.Select(attrs={'class': 'form-control'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.instance.created_by = user


# Profile Management Form
class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['name', 'profile_key', 'description']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'e.g., Senior Software Engineer'
            }),
            'profile_key': forms.Select(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': ''
            }),
        }