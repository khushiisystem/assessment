# core/templatetags/custom_filters.py
from django import template

register = template.Library()

@register.filter
def get_item(container, key):
    """
    Safe getter for templates.
    Handles:
      - dict-like objects (has .get)
      - list/sequence/dict indexing
      - model instances / objects with attributes
    Returns empty string if nothing found (to avoid displaying "None" in templates).
    """
    if container is None:
        return ''

    # If container is a dict-like object
    try:
        if hasattr(container, 'get'):
            # container.get may raise; guard with try/except
            try:
                result = container.get(key)
                return result if result is not None else ''
            except Exception:
                pass
    except Exception:
        pass

    # Try indexing
    try:
        result = container[key]
        return result if result is not None else ''
    except Exception:
        pass

    # Try attribute access (model instance)
    try:
        # try key as-is
        val = getattr(container, key, None)
        if val is not None:
            return val
        # try key as string
        val = getattr(container, str(key), None)
        return val if val is not None else ''
    except Exception:
        pass

    return ''


@register.filter
def attr(obj, attr_name):
    if obj is None:
        return None
    return getattr(obj, attr_name, None)

@register.filter
def split(value, delimiter=','):
    """string ko delimiter ke hisaab se split kare aur list return kare"""
    if value is None:
        return []
    return str(value).split(delimiter)


@register.filter
def format_datetime(value):
    """
    Format datetime to readable format: Oct 24, 2025 13:25
    Converts: 2025-10-24T07:56:31.897672+00:00 -> Oct 24, 2025 13:25
    """
    if value is None:
        return ""
    
    from django.utils import timezone
    from datetime import datetime
    
    # If it's a string, parse it
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except:
            return value
    
    # Convert to local timezone if needed
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    
    # Format: Oct 24, 2025 13:25
    return value.strftime("%b %d, %Y %H:%M")


@register.filter
def format_time_seconds(seconds):
    """
    Format seconds to readable time format
    Examples: 
      - 95 seconds -> 1m 35s
      - 3665 seconds -> 1h 1m 5s
    """
    if seconds is None or seconds == 0:
        return "0s"
    
    try:
        seconds = int(seconds)
    except:
        return str(seconds)
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if secs > 0 or not parts:
        parts.append(f"{secs}s")
    
    return " ".join(parts)


@register.filter
def is_assigned_to(candidate, assessment):
    """
    Check if a candidate is already assigned to a regular assessment
    Usage: {% if candidate|is_assigned_to:assessment %}
    """
    from core.models import CandidateAssessment
    return CandidateAssessment.objects.filter(
        candidate=candidate,
        assessment=assessment
    ).exists()


@register.filter
def is_assigned_to_ai(candidate, ai_assessment):
    """
    Check if a candidate is already assigned to an AI assessment
    Usage: {% if candidate|is_assigned_to_ai:ai_assessment %}
    """
    from AI_assessment.models import CandidateAIAssessment
    return CandidateAIAssessment.objects.filter(
        candidate=candidate,
        ai_assessment=ai_assessment
    ).exists()
