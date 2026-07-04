"""
Context processors to provide global template variables
"""
from django.db.models import Avg


def candidate_sidebar_context(request):
    """
    Provide sidebar context for candidate users
    """
    if not request.user.is_authenticated or request.user.role != 'candidate':
        return {}
    
    # Import models here to avoid circular imports
    from core.models import CandidateAssessment
    from AI_assessment.models import CandidateAIAssessment
    
    # Get candidate assessments from core app
    candidate_assessments = CandidateAssessment.objects.filter(candidate=request.user)
    
    assigned = candidate_assessments.filter(status='assigned')
    completed = candidate_assessments.filter(status='completed')
    
    assigned_count = assigned.count()
    completed_count = completed.count()
    
    # Calculate average score
    if completed.exists():
        average_score = completed.aggregate(avg=Avg('percentage'))['avg']
        average_score = round(average_score, 1) if average_score else 0
    else:
        average_score = 0
    
    # AI Assessments
    try:
        ai_assessments = CandidateAIAssessment.objects.filter(candidate=request.user)
        
        ai_assigned = ai_assessments.filter(status='assigned')
        ai_completed = ai_assessments.filter(status='completed')
        
        ai_assigned_count = ai_assigned.count()
        ai_completed_count = ai_completed.count()
        
        # Add AI counts to totals
        assigned_count += ai_assigned_count
        completed_count += ai_completed_count
        
    except Exception as e:
        # If AI_assessment models not available
        ai_assigned_count = 0
        ai_completed_count = 0
    
    # assigned_only_count should include both core and AI assessments
    assigned_only_count = assigned_count
    
    return {
        'assigned_count': assigned_count,
        'completed_count': completed_count,
        'assigned_only_count': assigned_only_count,  # Now includes both core + AI
        'average_score': average_score,
    }
